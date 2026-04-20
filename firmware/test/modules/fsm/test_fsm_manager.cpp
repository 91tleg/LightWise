#include <gtest/gtest.h>

#include "modules/fsm/fsm_manager.hpp"
#include "types/fsm_event.hpp"

using fsm::Event;
using fsm::EventData;
using fsm::Manager;
using fsm::Config;
using fsm::State;
using fsm::Outputs;

namespace
{
    EventData healthyData( float lux = 500.0f,
                           uint8_t overrideLevel = 75U )
    {
        EventData d;
        d.lux           = lux;
        d.overrideLevel = overrideLevel;
        d.temperature   = 22;
        d.humidity      = 50U;
        d.ambientHealth = SensorHealth::SYSTEM_OK;
        d.mmwaveHealth  = SensorHealth::SYSTEM_OK;
        d.thHealth      = SensorHealth::SYSTEM_OK;
        d.lightOk       = true;
        return d;
    }

    Config defaultConfig()
    {
        Config cfg {};
        cfg.dimLevel     = 20U;
        cfg.maxLevel     = 100U;
        cfg.manualLevel  = 80U;
        cfg.tempDimLevel = 40U;
        return cfg;
    }

    void initManager( Manager & mgr )
    {
        mgr.init();
        mgr.setConfig( defaultConfig() );
    }

} /* anonymous namespace */

class FsmTest : public ::testing::Test
{
protected:
    Manager   mgr;
    EventData d { healthyData() };

    void SetUp() override
    {
        initManager( mgr );
    }

    Outputs send( Event ev )
    {
        return mgr.process( ev, d );
    }

    Outputs send( Event ev, EventData data )
    {
        return mgr.process( ev, data );
    }

    State state() const
    {
        return mgr.currentState();
    }
};

TEST_F( FsmTest, InitStartsInAutoOff )
{
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmTest, InitReturnsToAutoOffAfterNavigation )
{
    send( Event::PhotocellDark );
    ASSERT_EQ( state(), State::AutoDim );

    mgr.init();
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmTest, SetConfigAndReadBack )
{
    Config cfg {};
    cfg.dimLevel = 33U;
    mgr.setConfig( cfg );
    EXPECT_EQ( mgr.config().dimLevel, 33U );
}


TEST_F( FsmTest, AutoOff_PhotocellDark_GoesToAutoDim )
{
    auto out = send( Event::PhotocellDark );
    EXPECT_EQ( state(), State::AutoDim );
    EXPECT_TRUE( out.sendUplink );
}

TEST_F( FsmTest, AutoOff_LoraOverrideOn_GoesToManualOn )
{
    d.overrideLevel = 60U;
    send( Event::LoraOverrideOn, d );
    EXPECT_EQ( state(), State::ManualOn );
    EXPECT_EQ( mgr.config().manualLevel, 60U );
}

TEST_F( FsmTest, AutoOff_LoraOverrideOff_GoesToManualOff )
{
    send( Event::LoraOverrideOff );
    EXPECT_EQ( state(), State::ManualOff );
}

TEST_F( FsmTest, AutoOff_LoraTempDim_StaysInAutoOff )
{
    /* TempDim stored but not yet active at dawn */
    d.overrideLevel = 30U;
    send( Event::LoraTempDim, d );
    EXPECT_EQ( state(), State::AutoOff );
    EXPECT_EQ( mgr.config().tempDimLevel, 30U );
}

TEST_F( FsmTest, AutoOff_FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmTest, AutoOff_IgnoredEvents_StayInAutoOff )
{
    for ( auto ev : { Event::PhotocellLight,
                      Event::MotionDetected,
                      Event::MotionTimeout,
                      Event::LoraResumeAuto,
                      Event::TempDimExpiry,
                      Event::ManualTimeout,
                      Event::FaultCleared } )
    {
        initManager( mgr );
        send( ev );
        EXPECT_EQ( state(), State::AutoOff ) << "Failed for event "
                                             << static_cast<int>( ev );
    }
}

class FsmAutoDimTest : public FsmTest
{
protected:
    void SetUp() override
    {
        FsmTest::SetUp();
        send( Event::PhotocellDark );   /* AutoOff -> AutoDim */
        ASSERT_EQ( state(), State::AutoDim );
    }
};

TEST_F( FsmAutoDimTest, PhotocellLight_GoesToAutoOff )
{
    send( Event::PhotocellLight );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmAutoDimTest, MotionDetected_GoesToMotionActive )
{
    auto out = send( Event::MotionDetected );
    EXPECT_EQ( state(), State::MotionActive );
    EXPECT_TRUE( out.sendUplink );
}

TEST_F( FsmAutoDimTest, LoraOverrideOn_GoesToManualOn )
{
    d.overrideLevel = 55U;
    send( Event::LoraOverrideOn, d );
    EXPECT_EQ( state(), State::ManualOn );
}

TEST_F( FsmAutoDimTest, LoraOverrideOff_GoesToManualOff )
{
    send( Event::LoraOverrideOff );
    EXPECT_EQ( state(), State::ManualOff );
}

TEST_F( FsmAutoDimTest, LoraTempDim_GoesToTempDim )
{
    d.overrideLevel = 25U;
    send( Event::LoraTempDim, d );
    EXPECT_EQ( state(), State::TempDim );
    EXPECT_EQ( mgr.config().tempDimLevel, 25U );
}

TEST_F( FsmAutoDimTest, FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmAutoDimTest, LightLevel_IsDimLevel )
{
    /* Outputs should reflect dimLevel while in AutoDim */
    Outputs out = send( Event::MotionTimeout ); /* ignored -> stays AutoDim */
    /* AutoDim ignores MotionTimeout — still in AutoDim */
    EXPECT_EQ( state(), State::AutoDim );
    EXPECT_EQ( out.lightLevel, mgr.config().dimLevel );
}

class FsmMotionActiveTest : public FsmAutoDimTest
{
protected:
    void SetUp() override
    {
        FsmAutoDimTest::SetUp();
        send( Event::MotionDetected );   /* AutoDim -> MotionActive */
        ASSERT_EQ( state(), State::MotionActive );
    }
};

TEST_F( FsmMotionActiveTest, MotionDetected_StaysInMotionActive )
{
    auto out = send( Event::MotionDetected );
    EXPECT_EQ( state(), State::MotionActive );
    /* Timer-reset only — uplink not required */
    EXPECT_FALSE( out.sendUplink );
}

TEST_F( FsmMotionActiveTest, MotionTimeout_GoesToAutoDim )
{
    auto out = send( Event::MotionTimeout );
    EXPECT_EQ( state(), State::AutoDim );
    EXPECT_TRUE( out.sendUplink );
}

TEST_F( FsmMotionActiveTest, PhotocellLight_GoesToAutoOff )
{
    send( Event::PhotocellLight );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmMotionActiveTest, LoraOverrideOn_GoesToManualOn )
{
    send( Event::LoraOverrideOn );
    EXPECT_EQ( state(), State::ManualOn );
}

TEST_F( FsmMotionActiveTest, LoraOverrideOff_GoesToManualOff )
{
    send( Event::LoraOverrideOff );
    EXPECT_EQ( state(), State::ManualOff );
}

TEST_F( FsmMotionActiveTest, FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmMotionActiveTest, LightLevel_IsMaxLevel )
{
    Outputs out = send( Event::MotionDetected );
    EXPECT_EQ( out.lightLevel, mgr.config().maxLevel );
}

TEST_F( FsmMotionActiveTest, MotionDetected_Field_IsTrue )
{
    Outputs out = send( Event::MotionDetected );
    EXPECT_TRUE( out.uplinkData.motionDetected );
}

class FsmManualOnTest : public FsmTest
{
protected:
    void SetUp() override
    {
        FsmTest::SetUp();
        d.overrideLevel = 80U;
        send( Event::LoraOverrideOn, d );   /* AutoOff -> ManualOn */
        ASSERT_EQ( state(), State::ManualOn );
    }
};

TEST_F( FsmManualOnTest, LoraResumeAuto_LuxLow_GoesToAutoDim )
{
    d.lux = 500.0f;     /* below 1000 threshold -> AutoDim */
    send( Event::LoraResumeAuto, d );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmManualOnTest, LoraResumeAuto_LuxHigh_GoesToAutoOff )
{
    d.lux = 2000.0f;    /* above threshold -> AutoOff */
    send( Event::LoraResumeAuto, d );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmManualOnTest, ManualTimeout_LuxLow_GoesToAutoDim )
{
    d.lux = 100.0f;
    auto out = send( Event::ManualTimeout, d );
    EXPECT_EQ( state(), State::AutoDim );
    EXPECT_TRUE( out.sendUplink );
}

TEST_F( FsmManualOnTest, ManualTimeout_LuxHigh_GoesToAutoOff )
{
    d.lux = 5000.0f;
    send( Event::ManualTimeout, d );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmManualOnTest, LoraOverrideOff_GoesToManualOff )
{
    send( Event::LoraOverrideOff );
    EXPECT_EQ( state(), State::ManualOff );
}

TEST_F( FsmManualOnTest, FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmManualOnTest, LightLevel_IsManualLevel )
{
    Outputs out = send( Event::MotionDetected ); /* ignored -> stays ManualOn */
    EXPECT_EQ( out.lightLevel, mgr.config().manualLevel );
}

class FsmManualOffTest : public FsmTest
{
protected:
    void SetUp() override
    {
        FsmTest::SetUp();
        send( Event::LoraOverrideOff );   /* AutoOff -> ManualOff */
        ASSERT_EQ( state(), State::ManualOff );
    }
};

TEST_F( FsmManualOffTest, LoraResumeAuto_LuxLow_GoesToAutoDim )
{
    d.lux = 300.0f;
    send( Event::LoraResumeAuto, d );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmManualOffTest, LoraResumeAuto_LuxHigh_GoesToAutoOff )
{
    d.lux = 9999.0f;
    send( Event::LoraResumeAuto, d );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmManualOffTest, ManualTimeout_GoesToAuto )
{
    d.lux = 200.0f;
    send( Event::ManualTimeout, d );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmManualOffTest, LoraOverrideOn_GoesToManualOn )
{
    d.overrideLevel = 70U;
    send( Event::LoraOverrideOn, d );
    EXPECT_EQ( state(), State::ManualOn );
    EXPECT_EQ( mgr.config().manualLevel, 70U );
}

TEST_F( FsmManualOffTest, FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmManualOffTest, LightLevel_IsZero )
{
    Outputs out = send( Event::MotionDetected ); /* ignored */
    EXPECT_EQ( out.lightLevel, 0U );
}

class FsmTempDimTest : public FsmTest
{
protected:
    void SetUp() override
    {
        FsmTest::SetUp();
        send( Event::PhotocellDark );           /* AutoOff -> AutoDim     */
        d.overrideLevel = 40U;
        send( Event::LoraTempDim, d );          /* AutoDim -> TempDim     */
        ASSERT_EQ( state(), State::TempDim );
    }
};

TEST_F( FsmTempDimTest, MotionDetected_GoesToMotionActive )
{
    send( Event::MotionDetected );
    EXPECT_EQ( state(), State::MotionActive );
}

TEST_F( FsmTempDimTest, TempDimExpiry_GoesToAutoDim )
{
    send( Event::TempDimExpiry );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmTempDimTest, PhotocellLight_GoesToAutoOff )
{
    send( Event::PhotocellLight );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmTempDimTest, LoraOverrideOn_GoesToManualOn )
{
    d.overrideLevel = 90U;
    send( Event::LoraOverrideOn, d );
    EXPECT_EQ( state(), State::ManualOn );
}

TEST_F( FsmTempDimTest, LoraOverrideOff_GoesToManualOff )
{
    send( Event::LoraOverrideOff );
    EXPECT_EQ( state(), State::ManualOff );
}

TEST_F( FsmTempDimTest, LoraResumeAuto_GoesToAutoDim )
{
    send( Event::LoraResumeAuto );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmTempDimTest, FaultDetected_GoesToFault )
{
    send( Event::FaultDetected );
    EXPECT_EQ( state(), State::Fault );
}

TEST_F( FsmTempDimTest, LightLevel_IsTempDimLevel )
{
    Outputs out = send( Event::ManualTimeout ); /* ignored -> stays TempDim */
    EXPECT_EQ( out.lightLevel, mgr.config().tempDimLevel );
}

class FsmFaultTest : public FsmTest
{
protected:
    void SetUp() override
    {
        FsmTest::SetUp();
        send( Event::FaultDetected );   /* AutoOff -> Fault */
        ASSERT_EQ( state(), State::Fault );
    }
};

TEST_F( FsmFaultTest, FaultCleared_LuxLow_GoesToAutoDim )
{
    d.lux = 100.0f;
    auto out = send( Event::FaultCleared, d );
    EXPECT_EQ( state(), State::AutoDim );
    EXPECT_TRUE( out.sendUplink );
}

TEST_F( FsmFaultTest, FaultCleared_LuxHigh_GoesToAutoOff )
{
    d.lux = 5000.0f;
    send( Event::FaultCleared, d );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmFaultTest, LoraOverrideOn_GoesToManualOn )
{
    d.overrideLevel = 50U;
    send( Event::LoraOverrideOn, d );
    EXPECT_EQ( state(), State::ManualOn );
}

TEST_F( FsmFaultTest, OtherEvents_StayInFault )
{
    for ( auto ev : { Event::PhotocellLight,
                      Event::PhotocellDark,
                      Event::MotionDetected,
                      Event::MotionTimeout,
                      Event::LoraOverrideOff,
                      Event::LoraResumeAuto,
                      Event::LoraTempDim,
                      Event::TempDimExpiry,
                      Event::ManualTimeout } )
    {
        EXPECT_EQ( state(), State::Fault )  /* guard */
                << "Pre-condition failed for event "
                << static_cast<int>( ev );
        send( ev );
        EXPECT_EQ( state(), State::Fault )
                << "Should stay Fault for event "
                << static_cast<int>( ev );
    }
}

TEST_F( FsmFaultTest, LightLevel_IsMaxLevel )
{
    Outputs out = send( Event::MotionDetected );
    EXPECT_EQ( out.lightLevel, mgr.config().maxLevel );
}


TEST_F( FsmTest, Outputs_LuxScaled )
{
    d.lux = 123.4f;
    Outputs out = send( Event::PhotocellDark, d );  /* -> AutoDim */
    EXPECT_EQ( out.uplinkData.lux_x10, static_cast< uint16_t >( 123.4f * 10.0f ) );
}

TEST_F( FsmTest, Outputs_TempAndHumidity )
{
    d.temperature = 25;
    d.humidity    = 60U;
    Outputs out = send( Event::PhotocellDark, d );
    EXPECT_EQ( out.uplinkData.tempC,    static_cast< int8_t >( 25 ) );
    EXPECT_EQ( out.uplinkData.humidity, 60U );
}

TEST_F( FsmTest, Outputs_ThOkWhenHealthy )
{
    d.thHealth = SensorHealth::SYSTEM_OK;
    Outputs out = send( Event::PhotocellDark, d );
    EXPECT_TRUE( out.uplinkData.thOk );
}

TEST_F( FsmTest, Outputs_ThNotOkWhenFailed )
{
    d.thHealth = SensorHealth::TOTAL_FAILURE;
    Outputs out = send( Event::PhotocellDark, d );
    EXPECT_FALSE( out.uplinkData.thOk );
}

TEST_F( FsmTest, Outputs_LightOkPassthrough )
{
    d.lightOk = false;
    Outputs out = send( Event::PhotocellDark, d );
    EXPECT_FALSE( out.uplinkData.lightOk );

    d.lightOk = true;
    out = send( Event::PhotocellLight, d );   /* back to AutoOff */
    EXPECT_TRUE( out.uplinkData.lightOk );
}

TEST_F( FsmTest, Outputs_MotionDetected_OnlyInMotionActive )
{
    /* AutoOff -> AutoDim */
    Outputs out = send( Event::PhotocellDark );
    EXPECT_FALSE( out.uplinkData.motionDetected );

    /* AutoDim -> MotionActive */
    out = send( Event::MotionDetected );
    EXPECT_TRUE( out.uplinkData.motionDetected );

    /* MotionActive -> AutoDim */
    out = send( Event::MotionTimeout );
    EXPECT_FALSE( out.uplinkData.motionDetected );
}


TEST_F( FsmTest, FullCycle_DuskMotionDawn )
{
    /* Dusk */
    send( Event::PhotocellDark );
    EXPECT_EQ( state(), State::AutoDim );

    /* Motion burst */
    send( Event::MotionDetected );
    EXPECT_EQ( state(), State::MotionActive );

    /* Timeout back to dim */
    send( Event::MotionTimeout );
    EXPECT_EQ( state(), State::AutoDim );

    /* Dawn */
    send( Event::PhotocellLight );
    EXPECT_EQ( state(), State::AutoOff );
}

TEST_F( FsmTest, ManualOverride_ThenResumeAuto_AtNight )
{
    send( Event::PhotocellDark );           /* -> AutoDim */
    d.overrideLevel = 80U;
    send( Event::LoraOverrideOn, d );       /* -> ManualOn */
    EXPECT_EQ( state(), State::ManualOn );

    d.lux = 200.0f;                         /* still dark */
    send( Event::LoraResumeAuto, d );       /* -> AutoDim  */
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmTest, FaultInMotionActive_ThenClearedAtNight )
{
    send( Event::PhotocellDark );
    send( Event::MotionDetected );
    ASSERT_EQ( state(), State::MotionActive );

    send( Event::FaultDetected );
    ASSERT_EQ( state(), State::Fault );

    d.lux = 50.0f;
    send( Event::FaultCleared, d );
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmTest, TempDim_ExpiresAndMotionRetriggersAtNight )
{
    send( Event::PhotocellDark );           /* -> AutoDim  */
    d.overrideLevel = 30U;
    send( Event::LoraTempDim, d );          /* -> TempDim  */

    send( Event::MotionDetected );          /* -> MotionActive */
    EXPECT_EQ( state(), State::MotionActive );

    send( Event::MotionTimeout );           /* -> AutoDim  */
    EXPECT_EQ( state(), State::AutoDim );
}

TEST_F( FsmTest, RepeatedFaultsAndClears )
{
    for ( int i { 0 }; i < 3; ++i )
    {
        send( Event::FaultDetected );
        EXPECT_EQ( state(), State::Fault );

        d.lux = 500.0f;
        send( Event::FaultCleared, d );
        EXPECT_EQ( state(), State::AutoDim );

        send( Event::PhotocellLight );
        EXPECT_EQ( state(), State::AutoOff );
    }
}
