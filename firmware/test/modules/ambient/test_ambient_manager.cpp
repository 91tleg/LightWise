#include <gtest/gtest.h>

#include "ambient_manager.hpp"
#include "lib/mock_ambient_sensor.hpp"
#include "types/ambient_data.hpp"
#include "utils/math/ema.hpp"

using ::testing::_;
using ::testing::Return;
using ::testing::DoAll;
using ::testing::SetArgReferee;

class AmbientManagerTest : public ::testing::Test
{
protected:
    MockAmbientSensor mockPrimary;
    MockAmbientSensor mockSecondary;

    filter::EMA< float > filterPrimary   { 1.0f };
    filter::EMA< float > filterSecondary { 1.0f };

    void ExpectRead( MockAmbientSensor & mock, float value, bool success = true )
    {
        EXPECT_CALL( mock, read( _ ) )
            .WillOnce( DoAll( SetArgReferee< 0 >( value ), Return( success ) ) );
    }
};

TEST_F( AmbientManagerTest, HandlesHealthySystem )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data { .lux = 0.0f, .health = SensorHealth::TOTAL_FAILURE };

    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 100.0f );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, 100.0f );
}

TEST_F( AmbientManagerTest, ReturnsDegradedWhenDifferenceExceedsThreshold )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data {};

    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 151.0f ); 

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::DEGRADED );
    EXPECT_FLOAT_EQ( data.lux, 125.5f );
}

TEST_F( AmbientManagerTest, HandlesSecondaryFailure )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data { .lux = 50.0f };

    ExpectRead( mockPrimary, 200.0f, true );
    ExpectRead( mockSecondary, 0.0f, false );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );
    EXPECT_FLOAT_EQ( data.lux, 200.0f );
}

TEST_F( AmbientManagerTest, HandlesPrimaryFailure )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data {};

    ExpectRead( mockPrimary, 0.0f, false );
    ExpectRead( mockSecondary, 300.0f, true );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::PRIMARY_FAIL );
    EXPECT_FLOAT_EQ( data.lux, 300.0f );
}

TEST_F( AmbientManagerTest, PreservesLastKnownLuxOnTotalFailure )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data { .lux = 123.4f, .health = SensorHealth::SYSTEM_OK };

    ExpectRead( mockPrimary, 0.0f, false );
    ExpectRead( mockSecondary, 0.0f, false );

    EXPECT_FALSE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
    /* Should remain unchanged if both failed */
    EXPECT_FLOAT_EQ( data.lux, 123.4f ); 
}

TEST_F( AmbientManagerTest, VerifiesEMAFilteringEffect )
{
    filter::EMA< float > filterP { 0.5f };
    filter::EMA< float > filterS { 0.5f };
    Manager mgr { mockPrimary, mockSecondary, filterP, filterS };
    Data data {};

    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 100.0f );
    static_cast< void > ( mgr.update( data ) );

    /* Filtered value = (Curr * 0.5) + (Prev * 0.5) = 150.0f */
    ExpectRead( mockPrimary, 200.0f );
    ExpectRead( mockSecondary, 200.0f );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_FLOAT_EQ( data.lux, 150.0f );
}

TEST_F( AmbientManagerTest, HandlesZeroLuxCorrectly )
{
    Manager mgr { mockPrimary, mockSecondary, filterPrimary, filterSecondary };
    Data data {};

    ExpectRead( mockPrimary, 0.0f );
    ExpectRead( mockSecondary, 0.0f );

    EXPECT_TRUE( mgr.update( data) ) ;
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, 0.0f );
}
