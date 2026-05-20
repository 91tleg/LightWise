#include <gtest/gtest.h>

#include "types/mmwave_data.hpp"
#include "mmwave_manager.hpp"
#include "lib/mock_mmwave_sensor.hpp"

using ::testing::Return;
using ::testing::DoDefault;

using namespace mmwave;

extern "C" void delay_ms( uint32_t delayMs )
{
    static_cast< void > ( delayMs );
}

ACTION_P( ReturnMotion, motion )
{
    arg0 = motion;
    return true;
}

ACTION( ReturnFail )
{
    return false;
}

class MmwaveManagerTest : public ::testing::Test
{
protected:
    void SetUp() override
    {
        manager_ = std::make_unique< Manager >( primary_, secondary_ );
    }

    void runCycles( int n,
                    bool pOk, bool pMotion,
                    bool sOk, bool sMotion )
    {
        for( int i { 0 }; i < n; ++i )
        {
            if( pOk )
                EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( pMotion ) );
            else
                EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );

            if( sOk )
                EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( sMotion ) );
            else
                EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );

            Data d {};
            static_cast< void > ( manager_->update( d ) );
        }
    }

    MockMmwaveSensor             primary_;
    MockMmwaveSensor             secondary_;
    std::unique_ptr< Manager >   manager_;

    static constexpr uint8_t kFailureThreshold          { 10U };
    static constexpr uint8_t kDegradedDisagreeThreshold { 3U  };
};

TEST_F( MmwaveManagerTest, Setup_BothSucceed_ReturnsTrue )
{
    EXPECT_CALL( primary_,   connect() ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, connect() ).WillOnce( Return( true ) );
    EXPECT_CALL( primary_,   setSensorMode( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setSensorMode( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( primary_,   setDetectionRange( ::testing::_, ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setDetectionRange( ::testing::_, ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( primary_,   setTrigSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setTrigSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( primary_,   setKeepSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setKeepSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( primary_,   setDelay( ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setDelay( ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );

    EXPECT_TRUE( manager_->setup() );
}

TEST_F( MmwaveManagerTest, Setup_PrimaryFails_ReturnsFalse )
{
    EXPECT_CALL( primary_, connect() )
        .Times( 5 )
        .WillRepeatedly( Return( false ) );
    EXPECT_CALL( secondary_, connect() ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setSensorMode( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setDetectionRange( ::testing::_, ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setTrigSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setKeepSensitivity( ::testing::_ ) ).WillOnce( Return( true ) );
    EXPECT_CALL( secondary_, setDelay( ::testing::_, ::testing::_ ) ).WillOnce( Return( true ) );

    EXPECT_FALSE( manager_->setup() );
}

TEST_F( MmwaveManagerTest, BothReadOk_BothMotion_MotionDetected )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );

    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_TRUE( d.motionDetected );
    EXPECT_EQ( d.health, SensorHealth::SYSTEM_OK );
}

TEST_F( MmwaveManagerTest, BothReadOk_NoMotion_NoMotionDetected )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );

    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_FALSE( d.motionDetected );
    EXPECT_EQ( d.health, SensorHealth::SYSTEM_OK );
}

TEST_F( MmwaveManagerTest, ORFusion_PrimaryMotion_SecondaryNot_MotionDetected )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );

    Data d {};
    static_cast< void > ( manager_->update( d ) );

    /* OR fusion — one sensor sees motion, output is true */
    EXPECT_TRUE( d.motionDetected );
}

TEST_F( MmwaveManagerTest, TransientPrimaryFail_UsesLastKnownMotion )
{
    /* Cycle 1: both OK, primary sees motion */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    Data d1 {};
    static_cast< void > ( manager_->update( d1 ) );
    EXPECT_TRUE( d1.motionDetected );

    /* Cycle 2: primary fails transiently — last known (true) is used */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    Data d2 {};
    static_cast< void > ( manager_->update( d2 ) );

    EXPECT_TRUE( d2.motionDetected );
    /* Single miss: not hard fail yet */
    EXPECT_NE( d2.health, SensorHealth::PRIMARY_FAIL );
}

TEST_F( MmwaveManagerTest, TransientSecondaryFail_DoesNotCancelMotion )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    Data d1 {};
    static_cast< void > ( manager_->update( d1 ) );

    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    Data d2 {};
    static_cast< void > ( manager_->update( d2 ) );

    EXPECT_TRUE( d2.motionDetected );
}

TEST_F( MmwaveManagerTest, PrimaryHardFail_AfterThresholdMisses )
{
    /* Run kFailureThreshold cycles with primary failing */
    runCycles( kFailureThreshold, false, false, true, false );

    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_EQ( d.health, SensorHealth::PRIMARY_FAIL );
}

TEST_F( MmwaveManagerTest, SecondaryHardFail_AfterThresholdMisses )
{
    runCycles( kFailureThreshold, true, false, false, false );

    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_EQ( d.health, SensorHealth::SECONDARY_FAIL );
}

TEST_F( MmwaveManagerTest, TotalFailure_BothExceedThreshold )
{
    runCycles( kFailureThreshold, false, false, false, false );

    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_EQ( d.health, SensorHealth::TOTAL_FAILURE );
}

TEST_F( MmwaveManagerTest, HardFail_RecoverAfterSuccessfulRead )
{
    /* Drive primary to hard fail */
    runCycles( kFailureThreshold, false, false, true, false );

    /* Primary recovers */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    /* Fail count resets on first successful read */
    EXPECT_EQ( d.health, SensorHealth::SYSTEM_OK );
}

TEST_F( MmwaveManagerTest, SinglePrimaryMiss_NotHardFail )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );

    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_NE( d.health, SensorHealth::PRIMARY_FAIL );
    EXPECT_NE( d.health, SensorHealth::TOTAL_FAILURE );
}

TEST_F( MmwaveManagerTest, SingleSecondaryMiss_NotHardFail )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );

    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_NE( d.health, SensorHealth::SECONDARY_FAIL );
    EXPECT_NE( d.health, SensorHealth::TOTAL_FAILURE );
}

TEST_F( MmwaveManagerTest, SustainedDisagreement_TriggersDegraded )
{
    /* Drive disagreeCount_ to threshold — sensors disagree every cycle */
    runCycles( kDegradedDisagreeThreshold - 1, true, true, true, false );

    /* One more cycle of disagreement should tip to DEGRADED */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_EQ( d.health, SensorHealth::DEGRADED );
}

TEST_F( MmwaveManagerTest, DisagreementResetsOnAgreement )
{
    runCycles( kDegradedDisagreeThreshold - 1, true, true, true, false );

    /* One cycle of agreement resets the counter */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    Data d1 {};
    static_cast< void > ( manager_->update( d1 ) );
    EXPECT_EQ( d1.health, SensorHealth::SYSTEM_OK );

    /* One more disagreement should not immediately re-trigger DEGRADED */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( true ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    Data d2 {};
    static_cast< void > ( manager_->update( d2 ) );
    EXPECT_NE( d2.health, SensorHealth::DEGRADED );
}

TEST_F( MmwaveManagerTest, DisagreeCounter_NotIncrementedOnFail )
{
    /* One sensor fails — disagree counter must not increment */
    runCycles( kDegradedDisagreeThreshold - 1, false, false, true, false );

    /* Now both agree — should be OK, not DEGRADED */
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    Data d {};
    static_cast< void > ( manager_->update( d ) );

    EXPECT_NE( d.health, SensorHealth::DEGRADED );
}

TEST_F( MmwaveManagerTest, Update_ReturnsFalse_WhenBothFail )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );

    Data d {};
    EXPECT_FALSE( manager_->update( d ) );
}

TEST_F( MmwaveManagerTest, Update_ReturnsTrue_WhenOneFails )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnFail() );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );

    Data d {};
    EXPECT_TRUE( manager_->update( d ) );
}

TEST_F( MmwaveManagerTest, Update_ReturnsTrue_WhenBothSucceed )
{
    EXPECT_CALL( primary_,   motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );
    EXPECT_CALL( secondary_, motionDetected( ::testing::_ ) ).WillOnce( ReturnMotion( false ) );

    Data d {};
    EXPECT_TRUE( manager_->update( d ) );
}
