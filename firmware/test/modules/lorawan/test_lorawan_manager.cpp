#include <cstdint>

#include <gtest/gtest.h>

#include "lib/mock_lorawan_sensor.hpp"
#include "modules/lorawan/lorawan_manager.hpp"
#include "types/lorawan_keys.hpp"

using namespace lorawan;
using ::testing::_;
using ::testing::AtLeast;
using ::testing::Return;

extern "C" void delay_ms( uint32_t delayMs )
{
    static_cast< void >( delayMs );
}

class LoRaWANManagerTest : public ::testing::Test
{
  protected:
    MockLorawanSensor mockSensor;
    Keys dummyKeys;

    void SetUp() override
    {
        dummyKeys.appKey.fill( 0xAA );
        dummyKeys.appEui.fill( 0xBB );
    }
};

TEST_F( LoRaWANManagerTest, SetupFullSuccess )
{
    Manager manager( mockSensor );

    EXPECT_CALL( mockSensor, setAppKey( _ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, setAppEui( _ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, begin() ).WillOnce( Return( true ) );

    EXPECT_CALL( mockSensor, setRegion( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setClass( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setDatarate( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setEirp( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setSubband( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, enableAdr( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setPacketType( _ ) ).WillRepeatedly( Return( true ) );

    EXPECT_CALL( mockSensor, join() ).WillOnce( Return( true ) );

    bool result { manager.setup( dummyKeys, 1000UL ) };

    EXPECT_TRUE( result );
    EXPECT_EQ( manager.state(), Manager::State::JOINING );
}

TEST_F( LoRaWANManagerTest, SetupFailsWhenBeginFails )
{
    Manager manager( mockSensor );

    EXPECT_CALL( mockSensor, setAppKey( _ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, setAppEui( _ ) ).WillOnce( Return( true ) );

    EXPECT_CALL( mockSensor, begin() ).WillOnce( Return( false ) );

    bool result { manager.setup( dummyKeys, 1000UL ) };

    EXPECT_FALSE( result );
    EXPECT_EQ( manager.state(), Manager::State::UNINITIALIZED );
}

TEST_F( LoRaWANManagerTest, JoinTransitionsToReady )
{
    Manager manager( mockSensor );

    EXPECT_CALL( mockSensor, setAppKey( _ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, setAppEui( _ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, begin() ).WillOnce( Return( true ) );
    EXPECT_CALL( mockSensor, join() ).WillOnce( Return( true ) );

    EXPECT_CALL( mockSensor, setRegion( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setClass( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setDatarate( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setEirp( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setSubband( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, enableAdr( _ ) ).WillRepeatedly( Return( true ) );
    EXPECT_CALL( mockSensor, setPacketType( _ ) ).WillRepeatedly( Return( true ) );

    static_cast< void >( manager.setup( dummyKeys, 1000UL ) );

    EXPECT_CALL( mockSensor, isJoined() ).WillOnce( Return( true ) );

    bool ready { manager.tryAdvanceJoin( 2000UL ) };

    EXPECT_TRUE( ready );
    EXPECT_EQ( manager.state(), lorawan::Manager::State::READY );
}
