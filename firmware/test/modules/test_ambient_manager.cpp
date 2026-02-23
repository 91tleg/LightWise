#include <gtest/gtest.h>

#include "ambient_manager.hpp"
#include "lib/mock_ambient_sensor.hpp"
#include "types/ambient_data.hpp"

class AmbientManagerTest : public ::testing::Test
{
  protected:
    MockAmbientSensor mockPrimary;
    MockAmbientSensor mockSecondary;
    float alpha = 1.0f;

    void ExpectRead( MockAmbientSensor &mock, float value, bool success = true )
    {
        EXPECT_CALL( mock, read( _ ) )
            .WillOnce( DoAll( SetArgReferee<0>( value ), Return( success ) ) );
    }
};

/* Initialization */
TEST_F( AmbientManagerTest, HandlesNullSensorsGracefully )
{
    Manager mgr( nullptr, nullptr, alpha );
    Data data;
    EXPECT_FALSE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
}

/* Health logic */
TEST_F( AmbientManagerTest, ReturnsSystemOkWhenSensorsAreConsistent )
{
    Manager mgr( &mockPrimary, &mockSecondary, alpha );
    Data data;

    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 105.0f ); /* Difference (5.0) < Threshold (10.0) */

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, 102.5f );
}

TEST_F( AmbientManagerTest, ReturnsDegradedWhenDifferenceExceedsThreshold )
{
    Manager mgr( &mockPrimary, &mockSecondary, alpha );
    Data data;

    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 115.0f ); /* Difference (15.0) > Threshold (10.0) */

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::DEGRADED );
}

/* Failure mode */
TEST_F( AmbientManagerTest, HandlesSecondaryFailure )
{
    Manager mgr( &mockPrimary, &mockSecondary, alpha );
    Data data;

    ExpectRead( mockPrimary, 200.0f, true );
    ExpectRead( mockSecondary, 0.0f, false ); /* Secondary fails */

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::SECONDARY_FAIL );
    EXPECT_FLOAT_EQ( data.lux, 200.0f ); /* Should only use primary value */
}

TEST_F( AmbientManagerTest, HandlesPrimaryFailure )
{
    Manager mgr( &mockPrimary, &mockSecondary, alpha );
    Data data;

    ExpectRead( mockPrimary, 0.0f, false ); /* Primary fails */
    ExpectRead( mockSecondary, 300.0f, true );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::PRIMARY_FAIL );
    EXPECT_FLOAT_EQ( data.lux, 300.0f ); /* Should only use secondary value */
}

TEST_F( AmbientManagerTest, ReturnsFalseOnTotalFailure )
{
    Manager mgr( &mockPrimary, &mockSecondary, alpha );
    Data data;

    ExpectRead( mockPrimary, 0.0f, false );
    ExpectRead( mockSecondary, 0.0f, false );

    EXPECT_FALSE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
}

/* EMA */
TEST_F( AmbientManagerTest, VerifiesEMAFilteringOverMultipleUpdates )
{
    Manager mgr( &mockPrimary, &mockSecondary, 0.5f );
    Data data;

    /* First Update: EMA initializes to the first values */
    ExpectRead( mockPrimary, 100.0f );
    ExpectRead( mockSecondary, 100.0f );
    mgr.update( data );

    /* EMA = (0.5 * 200) + (0.5 * 100) = 150.0 */
    ExpectRead( mockPrimary, 200.0f );
    ExpectRead( mockSecondary, 200.0f );

    mgr.update( data );
    EXPECT_FLOAT_EQ( data.lux, 150.0f );
}
