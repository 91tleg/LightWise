#include <gtest/gtest.h>

#include "ambient_manager.hpp"
#include "lib/mock_ambient_sensor.hpp"
#include "types/ambient_data.hpp"
#include "utils/math/kalman1d.hpp"

using ::testing::_;
using ::testing::Return;
using ::testing::DoAll;
using ::testing::SetArgReferee;

using ambient::Data;
using ambient::Manager;

class AmbientManagerTest : public ::testing::Test
{
protected:
    MockAmbientSensor mockPrimary;
    MockAmbientSensor mockSecondary;
    filter::Kalman1D  kf { 4.0f };
    Manager           mgr { mockPrimary, mockSecondary, kf };
    Data              data {};

    void ExpectRead( MockAmbientSensor & mock, float value, bool success = true )
    {
        EXPECT_CALL( mock, read( _ ) )
            .WillOnce( DoAll( SetArgReferee< 0 >( value ), Return( success ) ) )
            .RetiresOnSaturation();
    }

    /* One full update cycle with scripted sensor readings */
    bool Step( float zP, bool pOk, float zS, bool sOk )
    {
        ExpectRead( mockPrimary, zP, pOk );
        ExpectRead( mockSecondary, zS, sOk );
        return mgr.update( data );
    }

    /* Both sensors healthy at the same value, n cycles */
    void Warm( float value, int n )
    {
        for( int i { 0 }; i < n; ++i )
        {
            static_cast< void >( Step( value, true, value, true ) );
        }
    }
};

/* Basic behavior. */

TEST_F( AmbientManagerTest, HandlesHealthySystem )
{
    data = Data { .lux = 0.0f, .health = SensorHealth::TOTAL_FAILURE };

    EXPECT_TRUE( Step( 100.0f, true, 100.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, 100.0f );
}

TEST_F( AmbientManagerTest, HandlesZeroLuxCorrectly )
{
    EXPECT_TRUE( Step( 0.0f, true, 0.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, 0.0f );
}

TEST_F( AmbientManagerTest, PreservesLastKnownLuxOnTotalFailure )
{
    data = Data { .lux = 123.4f, .health = SensorHealth::SYSTEM_OK };

    EXPECT_FALSE( Step( 0.0f, false, 0.0f, false ) );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
    EXPECT_FLOAT_EQ( data.lux, 123.4f );
}

TEST_F( AmbientManagerTest, PreservesLuxOnTotalFailureAfterWarmup )
{
    Warm( 100.0f, 10 );
    EXPECT_FALSE( Step( 0.0f, false, 0.0f, false ) );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
    EXPECT_NEAR( data.lux, 100.0f, 0.5f );
}

/* Read failures (debounced). */

TEST_F( AmbientManagerTest, SingleSensorColdStartStillProducesLux )
{
    EXPECT_TRUE( Step( 200.0f, true, 0.0f, false ) );
    EXPECT_FLOAT_EQ( data.lux, 200.0f );
}

TEST_F( AmbientManagerTest, SecondaryReadFailureDeclaredAfterDebounce )
{
    Warm( 200.0f, 10 );

    for( int i { 0 }; i < 4; ++i )
    {
        EXPECT_TRUE( Step( 200.0f, true, 0.0f, false ) );
        EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK ) << "cycle " << i;
    }

    EXPECT_TRUE( Step( 200.0f, true, 0.0f, false ) );
    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );
    EXPECT_NEAR( data.lux, 200.0f, 0.5f );
}

TEST_F( AmbientManagerTest, PrimaryReadFailureDeclaredAfterDebounce )
{
    Warm( 300.0f, 10 );

    for( int i { 0 }; i < 5; ++i )
    {
        EXPECT_TRUE( Step( 0.0f, false, 300.0f, true ) );
    }

    EXPECT_EQ( data.health, SensorHealth::PRIMARY_FAIL );
    EXPECT_NEAR( data.lux, 300.0f, 0.5f );
}

/* Fault isolation. */

TEST_F( AmbientManagerTest, IsolatesSecondaryWhenItDisagreesWithPrediction )
{
    Warm( 100.0f, 10 );

    for( int i { 0 }; i < 5; ++i )
    {
        EXPECT_TRUE( Step( 100.0f, true, 300.0f, true ) );
    }

    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );
    EXPECT_NEAR( data.lux, 100.0f, 1.0f );   /* bad sensor ignored */
}

TEST_F( AmbientManagerTest, IsolatesPrimaryWhenItDisagreesWithPrediction )
{
    Warm( 100.0f, 10 );

    for( int i { 0 }; i < 5; ++i )
    {
        EXPECT_TRUE( Step( 0.0f, true, 100.0f, true ) );   /* stuck at 0 */
    }

    EXPECT_EQ( data.health, SensorHealth::PRIMARY_FAIL );
    EXPECT_NEAR( data.lux, 100.0f, 1.0f );
}

TEST_F( AmbientManagerTest, SingleSpikeDoesNotChangeHealth )
{
    Warm( 100.0f, 10 );

    EXPECT_TRUE( Step( 100.0f, true, 1000.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );

    Warm( 100.0f, 3 );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_NEAR( data.lux, 100.0f, 1.0f );
}

TEST_F( AmbientManagerTest, FaultRecoveryHasHysteresis )
{
    Warm( 100.0f, 10 );

    for( int i { 0 }; i < 10; ++i )   /* saturate counter at kFaultMax */
    {
        static_cast< void >( Step( 100.0f, true, 300.0f, true ) );
    }
    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );

    /* 10 -> 5 after five good cycles: still tripped */
    for( int i { 0 }; i < 5; ++i )
    {
        static_cast< void >( Step( 100.0f, true, 100.0f, true ) );
    }
    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );

    /* One more good cycle drops below the limit */
    static_cast< void >( Step( 100.0f, true, 100.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
}

/* Ambiguity. */

TEST_F( AmbientManagerTest, ReportsDegradedWhenSensorsDisagreeAndPredictionCannotArbitrate )
{
    /* Cold start: the filter is seeded from the midpoint, so both sensors
       pass the gate against it, yet they disagree with each other. */
    EXPECT_TRUE( Step( 100.0f, true, 151.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::DEGRADED );
    EXPECT_GT( data.lux, 100.0f );
    EXPECT_LT( data.lux, 151.0f );
}

TEST_F( AmbientManagerTest, AmbiguousCyclesDoNotAccumulateFaults )
{
    for( int i { 0 }; i < 20; ++i )
    {
        static_cast< void >( Step( 100.0f, true, 151.0f, true ) );
        EXPECT_EQ( data.health, SensorHealth::DEGRADED ) << "cycle " << i;
    }
    EXPECT_GT( data.lux, 100.0f );
    EXPECT_LT( data.lux, 151.0f );
}

/* Real changes must not be mistaken for faults. */

TEST_F( AmbientManagerTest, AcceptsRealStepWhenBothSensorsAgree )
{
    Warm( 100.0f, 10 );

    EXPECT_TRUE( Step( 500.0f, true, 500.0f, true ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_GT( data.lux, 400.0f );   /* jumped toward 500 in one cycle */

    Warm( 500.0f, 3 );
    EXPECT_NEAR( data.lux, 500.0f, 5.0f );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
}

/* Sustained ambiguity is resolved by distance from the estimate. */

TEST_F( AmbientManagerTest, SustainedDisagreementBlamesSensorFartherFromEstimate )
{
    Warm( 100.0f, 10 );

    /* Secondary drifts by an amount the widened P keeps letting through. */
    SensorHealth last { SensorHealth::SYSTEM_OK };
    for( int i { 0 }; i < 40; ++i )
    {
        static_cast< void >( Step( 100.0f, true, 100.0f + 3.0f * static_cast< float >( i ), true ) );
        last = data.health;
        if( last == SensorHealth::SECONDARY_FAIL ) { break; }
    }

    EXPECT_EQ( last, SensorHealth::SECONDARY_FAIL );
    EXPECT_NEAR( data.lux, 100.0f, 15.0f );
}

/* One sensor unreadable: a real step must not fault the survivor. */

TEST_F( AmbientManagerTest, SingleSensorStepDoesNotFaultTheSurvivor )
{
    Warm( 100.0f, 10 );

    for( int i { 0 }; i < 12; ++i )
    {
        EXPECT_TRUE( Step( 800.0f, true, 0.0f, false ) );
        EXPECT_NE( data.health, SensorHealth::PRIMARY_FAIL ) << "cycle " << i;
        EXPECT_NE( data.health, SensorHealth::TOTAL_FAILURE ) << "cycle " << i;
    }

    EXPECT_NEAR( data.lux, 800.0f, 10.0f );   /* reseeded onto the new level */
}
