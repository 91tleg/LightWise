#include "mmwave_manager.hpp"

#include <algorithm>  /* std::min */

#include "types/mmwave_data.hpp"
#include "utils/log/log.h"
#include "utils/time/delay.h"

namespace mmwave
{

    namespace
    {

        constexpr char kTag[] { "MmwaveManager" };

    } /* anonymous namespace */

    Manager::Manager( MmwaveSensor & primary,
                      MmwaveSensor & secondary ) noexcept
        : primary_ { primary }
        , secondary_ { secondary }
        , primaryFailCount_ { 0U }
        , secondaryFailCount_ { 0U }
        , disagreeCount_ { 0U }
        , lastPrimaryMotion_ { false }
        , lastSecondaryMotion_ { false }
    {

    }

    bool Manager::setupSensor( MmwaveSensor & sensor,
                               bool hasKeepSensitivity ) noexcept
    {
        bool connected { false };

        for( uint8_t attempt { 0U };
             ( attempt < kMaxConnectAttempts ) && !connected;
             ++attempt )
        {
            if( sensor.connect() )
            {
                connected = true;
            }
            else
            {
                LOGI( kTag, "Connect retry %u/%u",
                      static_cast< unsigned >( attempt + 1U ),
                      static_cast< unsigned >( kMaxConnectAttempts ) );
                delay_ms( kConnectRetryDelayMs );
            }
        }

        bool result { connected };

        if( result )
        {
            result = result && sensor.setSensorMode( kSensorMode );
            result = result && sensor.setDetectionRange( kDetectionRangeMin,
                                                         kDetectionRangeMax,
                                                         kTrigRange );
            result = result && sensor.setTrigSensitivity( kTrigSensitivity );

            if( hasKeepSensitivity )
            {
                result = result && sensor.setKeepSensitivity( kKeepSensitivity );
            }

            result = result && sensor.setDelay( kTrigDelay, kKeepDelay );
        }

        return result;
    }

    bool Manager::setup() noexcept
    {
        const bool primaryOk   { setupSensor( primary_.get(),   false ) };
        const bool secondaryOk { setupSensor( secondary_.get(), true  ) };

        LOGI( kTag, "Primary setup:   %s", primaryOk   ? "success" : "failed" );
        LOGI( kTag, "Secondary setup: %s", secondaryOk ? "success" : "failed" );

        return ( primaryOk && secondaryOk );
    }

    bool Manager::update( Data & data ) noexcept
    {
        bool pMotion { false };
        bool sMotion { false };

        const bool pReadOk { primary_.get().motionDetected( pMotion ) };
        const bool sReadOk { secondary_.get().motionDetected( sMotion ) };

        if( pReadOk )
        {
            primaryFailCount_  = 0U;
            lastPrimaryMotion_ = pMotion;
        }
        else
        {
            primaryFailCount_ = std::min(
                static_cast< uint8_t >( primaryFailCount_ + 1U ),
                kFailureThreshold );
        }

        if( sReadOk )
        {
            secondaryFailCount_  = 0U;
            lastSecondaryMotion_ = sMotion;
        }
        else
        {
            secondaryFailCount_ = std::min(
                static_cast< uint8_t >( secondaryFailCount_ + 1U ),
                kFailureThreshold );
        }

        /* Both sensors read OK and disagree: increment disagree counter.      */
        /* Both sensors read OK and agree:    reset disagree counter.          */
        /* One or both failed:                counter unchanged this cycle.    */
        if( pReadOk && sReadOk )
        {
            if( pMotion != sMotion )
            {
                disagreeCount_ = std::min(
                    static_cast< uint8_t >( disagreeCount_ + 1U ),
                    kDegradedDisagreeThreshold );
            }
            else
            {
                disagreeCount_ = 0U;
            }
        }

        SensorHealth health { SensorHealth::TOTAL_FAILURE };

        if( pReadOk && sReadOk )
        {
            health = SensorHealth::SYSTEM_OK;
        }
        else if( pReadOk )
        {
            health = SensorHealth::SECONDARY_FAIL;
        }
        else if( sReadOk )
        {
            health = SensorHealth::PRIMARY_FAIL;
        }
        else
        {
            health = SensorHealth::TOTAL_FAILURE;
        }

        /* Sensor disagreement over N consecutive cycles. */
        if( ( health == SensorHealth::SYSTEM_OK ) &&
            ( disagreeCount_ >= kDegradedDisagreeThreshold ) )
        {
            health = SensorHealth::DEGRADED;
        }

        /* Soft degradation: consecutive failures below hard-fail threshold.    */
        /* Does not override TOTAL_FAILURE — the FSM needs to see hard failure. */
        if( ( health != SensorHealth::TOTAL_FAILURE ) &&
            ( ( primaryFailCount_   > 0U ) ||
            ( secondaryFailCount_ > 0U ) ) )
        {
            /* Only degrade if below the hard-fail threshold — above it the  */
            /* PRIMARY_FAIL / SECONDARY_FAIL classification already applies. */
            const bool primarySoft { primaryFailCount_   > 0U &&
                                     primaryFailCount_   < kFailureThreshold };
            const bool secondarySoft { secondaryFailCount_ > 0U &&
                                       secondaryFailCount_ < kFailureThreshold };

            if( primarySoft || secondarySoft )
            {
                health = SensorHealth::DEGRADED;
            }
        }

        /* OR fusion — any confirmed detection triggers the output.             */
        /* On partial failure, use the last known value of the failed sensor    */
        /* so a single dropout does not cancel a valid detection.               */
        const bool effectivePrimary   { pReadOk ? pMotion : lastPrimaryMotion_   };
        const bool effectiveSecondary { sReadOk ? sMotion : lastSecondaryMotion_ };

        const bool motionDetected { effectivePrimary || effectiveSecondary };

        data.motionDetected = motionDetected;
        data.health         = health;

        return ( pReadOk || sReadOk );
    }

} /* namespace mmwave */
