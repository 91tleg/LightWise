#include <gmock/gmock.h>
#include <gtest/gtest.h>
#include "lib/mock_th_sensor.hpp"
#include "th_manager.hpp"

using namespace th;
using ::testing::_;
using ::testing::DoAll;
using ::testing::Return;
using ::testing::SetArgReferee;

class THManagerTest : public ::testing::Test
{
  protected:
    MockTHSensor mockSensor;
    const float kAlpha = 1.0f;

    void SetUp() override
    {

    }
};

/* Health & Logic */
TEST_F( THManagerTest, Update_ReturnsSystemOk_WhenReadSucceeds )
{
    Manager mgr( &mockSensor, kAlpha );
    Data data;

    EXPECT_CALL( mockSensor, read( _, _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 25 ), SetArgReferee<1>( 50 ), Return( true ) ) );

    bool result = mgr.update( data );

    EXPECT_TRUE( result );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_EQ( data.temperature, 25 );
    EXPECT_EQ( data.humidity, 50 );
}

TEST_F( THManagerTest, Update_ReturnsTotalFailure_WhenReadFails )
{
    Manager mgr( &mockSensor, kAlpha );
    Data data;

    EXPECT_CALL( mockSensor, read( _, _ ) ).WillOnce( Return( false ) );

    bool result = mgr.update( data );

    EXPECT_FALSE( result );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
    EXPECT_EQ( data.temperature, 0 );
    EXPECT_EQ( data.humidity, 0 );
}

TEST_F( THManagerTest, Update_HandlesNullSensorGracefully )
{
    Manager mgr( nullptr, kAlpha );
    Data data;

    bool result = mgr.update( data );

    EXPECT_FALSE( result );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
}

/* EMA */
TEST_F( THManagerTest, Update_AppliesEmaFiltering )
{
    /* alpha = 0.5: NewValue * 0.5 + OldValue * 0.5 */
    Manager mgr( &mockSensor, 0.5f );
    Data data;

    EXPECT_CALL( mockSensor, read( _, _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 100 ), SetArgReferee<1>( 100 ), Return( true ) ) );
    mgr.update( data );

    /* Expected output = (100 * 0.5) + (200 * 0.5) = 150 */
    EXPECT_CALL( mockSensor, read( _, _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 200 ), SetArgReferee<1>( 200 ), Return( true ) ) );

    mgr.update( data );
    EXPECT_EQ( data.temperature, 150 );
    EXPECT_EQ( data.humidity, 150 );
}

/* Boundary */
TEST_F( THManagerTest, Update_RejectsValuesOutsideValidRange )
{
    Manager mgr( &mockSensor, kAlpha );
    Data data;

    EXPECT_CALL( mockSensor, read( _, _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 255 ), SetArgReferee<1>( 255 ), Return( true ) ) );

    EXPECT_TRUE( mgr.update( data ) );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
}
