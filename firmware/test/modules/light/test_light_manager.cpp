#include <gtest/gtest.h>

#include "light_manager.hpp"
#include "lib/mock_light_sensor.hpp"
#include "lib/mock_led_presence.hpp"

using namespace light;
using ::testing::_;
using ::testing::Return;
using ::testing::InSequence;

class LightManagerTest : public ::testing::Test
{
protected:
    MockLightSensor mockLed;
    MockLedPresence mockPresence;

    void SetInitialLevel( Manager & mgr, uint8_t level )
    {
        mgr.setTarget( level, 255U );
        EXPECT_CALL( mockLed, setLevel( _ ) ).WillRepeatedly( Return( true ) );
        while( mgr.isRamping() )
        {
            static_cast< void >( mgr.step() );
        }
    }
};

TEST_F( LightManagerTest, InitialStateNotRamping )
{
    Manager mgr { mockLed, mockPresence };
    EXPECT_FALSE( mgr.isRamping() );
    EXPECT_EQ( mgr.getTarget(), 0U );
}

TEST_F( LightManagerTest, SetTargetStartsRamping )
{
    Manager mgr { mockLed, mockPresence };
    mgr.setTarget( 100U, 60U );

    EXPECT_TRUE( mgr.isRamping() );
    EXPECT_EQ( mgr.getTarget(), 100U );
    /* 1000ms / 60 steps = 16ms */
    EXPECT_EQ( mgr.stepIntervalMs(), 16U ); 
}

TEST_F( LightManagerTest, StepIncrementsLevelOneByOne )
{
    Manager mgr { mockLed, mockPresence };
    mgr.setTarget( 2U, 60U );

    InSequence seq;
    EXPECT_CALL( mockLed, setLevel( 1U ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockLed, setLevel( 2U ) ).WillOnce( Return( true ) );

    EXPECT_FALSE( mgr.step() );
    EXPECT_TRUE( mgr.step() );
    EXPECT_FALSE( mgr.isRamping() );
}

TEST_F( LightManagerTest, StepRetriesOnHardwareFailure )
{
    Manager mgr { mockLed, mockPresence };
    mgr.setTarget( 10U, 60U );

    /* Fail the first hardware write */
    EXPECT_CALL( mockLed, setLevel( 1U ) ).WillOnce( Return( false ) );
    
    EXPECT_FALSE( mgr.step() );
    EXPECT_TRUE( mgr.isRamping() ); // Should stay true to retry

    /* Next step should retry level 1U */
    EXPECT_CALL( mockLed, setLevel( 1U ) ).WillOnce( Return( true ) );
    static_cast< void > ( mgr.step() );
}

TEST_F( LightManagerTest, HandlesDownwardsRamp )
{
    Manager mgr { mockLed, mockPresence };
    SetInitialLevel( mgr, 10U );

    mgr.setTarget( 8U, 60U );
    InSequence seq;
    EXPECT_CALL( mockLed, setLevel( 9U ) ).WillOnce( Return( true ) );
    EXPECT_CALL( mockLed, setLevel( 8U ) ).WillOnce( Return( true ) );

    EXPECT_FALSE( mgr.step() );
    EXPECT_TRUE( mgr.step() );
    EXPECT_FALSE( mgr.isRamping() );
}

TEST_F( LightManagerTest, StepReturnsTrueImmediatelyWhenNotRamping )
{
    Manager mgr { mockLed, mockPresence };
    
    EXPECT_CALL( mockLed, setLevel( _ ) ).Times( 0 );
    
    EXPECT_FALSE( mgr.isRamping() );
    EXPECT_TRUE( mgr.step() );
}

TEST_F( LightManagerTest, SetTargetClampsZeroStepsToOne )
{
    Manager mgr { mockLed, mockPresence };
    mgr.setTarget( 50U, 0U );
    
    EXPECT_EQ( mgr.stepIntervalMs(), 1000U );
}
