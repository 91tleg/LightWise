#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include "th_manager.hpp"
#include "lib/mock_th_sensor.hpp"
#include "utils/math/ema.hpp"
#include "types/th_data.hpp"

using namespace th;
using ::testing::_;
using ::testing::Return;
using ::testing::DoAll;
using ::testing::SetArgReferee;

class ThManagerTest : public ::testing::Test
{
protected:
    MockTHSensor           mockSensor;
    filter::EMA< int8_t > tempFilter { 1 };
    filter::EMA< uint8_t > humFilter  { 1U };

    th::Manager manager { mockSensor, tempFilter, humFilter };

    void ExpectRead( int8_t temp, uint8_t hum, bool success = true )
    {
        EXPECT_CALL( mockSensor, read( _, _ ) )
            .WillOnce( DoAll( SetArgReferee< 0 >( temp ),
                              SetArgReferee< 1 >( hum ),
                              Return( success ) ) );
    }
};

/* Successful read */

TEST_F( ThManagerTest, SuccessfulRead_PopulatesData )
{
    ExpectRead( 22U, 60U );

    Data d {};
    EXPECT_TRUE( manager.update( d ) );
    EXPECT_EQ( d.temperature, 22U );
    EXPECT_EQ( d.humidity,    60U );
    EXPECT_EQ( d.health, SensorHealth::SYSTEM_OK );
}

TEST_F( ThManagerTest, SuccessfulRead_ReturnsTrue )
{
    ExpectRead( 20U, 50U );

    Data d {};
    EXPECT_TRUE( manager.update( d ) );
}

/* Failed read */

TEST_F( ThManagerTest, FailedRead_ReturnsFalse )
{
    ExpectRead( 0U, 0U, false );

    Data d {};
    EXPECT_FALSE( manager.update( d ) );
}

TEST_F( ThManagerTest, FailedRead_SetsHealthTotalFailure )
{
    ExpectRead( 0U, 0U, false );

    Data d {};
    static_cast< void >( manager.update( d ) );
    EXPECT_EQ( d.health, SensorHealth::TOTAL_FAILURE );
}

TEST_F( ThManagerTest, FailedRead_ZeroesOutputData )
{
    ExpectRead( 0U, 0U, false );

    Data d {};
    d.temperature = 99;
    d.humidity    = 99U;
    static_cast< void >( manager.update( d ) );

    EXPECT_EQ( d.temperature, 0U );
    EXPECT_EQ( d.humidity,    0U );
}

/* EMA filter — alpha 1.0 passes value through unchanged */

TEST_F( ThManagerTest, EmaAlphaOne_PassesThroughUnfiltered )
{
    ExpectRead( 25U, 65U );

    Data d {};
    static_cast< void >( manager.update( d ) );

    /* Alpha = 1.0 — filtered value equals raw value */
    EXPECT_EQ( d.temperature, 25U );
    EXPECT_EQ( d.humidity,    65U );
}

TEST_F( ThManagerTest, MultipleReads_FilterConverges )
{
    /* With alpha = 1.0 each read replaces the previous */
    ExpectRead( 20U, 50U );
    Data d1 {};
    static_cast< void >( manager.update( d1 ) );

    ExpectRead( 30U, 70U );
    Data d2 {};
    static_cast< void >( manager.update( d2 ) );

    EXPECT_EQ( d2.temperature, 30U );
    EXPECT_EQ( d2.humidity,    70U );
}

/* Health classification */

TEST_F( ThManagerTest, HealthSystemOk_WhenReadSucceeds )
{
    ExpectRead( 22U, 60U );

    Data d {};
    static_cast< void >( manager.update( d ) );
    EXPECT_EQ( d.health, SensorHealth::SYSTEM_OK );
}

TEST_F( ThManagerTest, HealthTotalFailure_WhenReadFails )
{
    ExpectRead( 0U, 0U, false );

    Data d {};
    static_cast< void >( manager.update( d ) );
    EXPECT_EQ( d.health, SensorHealth::TOTAL_FAILURE );
}
