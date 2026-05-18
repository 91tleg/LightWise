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

    bool Manager::setupSensor( MmwaveSensor & sensor ) noexcept
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

        if( connected )
        {
            connected = sensor.setSensorMode( kSensorMode )
                    && sensor.setDetectionRange( kDetectionRangeMin,
                                                 kDetectionRangeMax,
                                                 kTrigRange )
                    && sensor.setTrigSensitivity( kTrigSensitivity )
                    && sensor.setKeepSensitivity( kKeepSensitivity )
                    && sensor.setDelay( kTrigDelay, kKeepDelay );
        }
        return connected;
    }

    bool Manager::setup() noexcept
    {
        const bool primaryOk   { setupSensor( primary_ ) };
        const bool secondaryOk { setupSensor( secondary_ ) };

        LOGI( kTag, "Primary setup:   %s", primaryOk   ? "success" : "failed" );
        LOGI( kTag, "Secondary setup: %s", secondaryOk ? "success" : "failed" );

        return ( primaryOk && secondaryOk );
    }

    bool Manager::update( Data & data ) noexcept
    {
        bool pMotion { false };
        bool sMotion { false };
        const bool pReadOk { primary_.motionDetected( pMotion ) };
        const bool sReadOk { secondary_.motionDetected( sMotion ) };
        LOGI( kTag, "pREAD:%s, sREAD:%s", pReadOk ? "OK" : "fail", sReadOk ? "OK" : "fail" );

        primaryFailCount_ = pReadOk
                            ? 0U
                            : std::min( static_cast< uint8_t >( primaryFailCount_ + 1U ), kFailureThreshold );
        secondaryFailCount_ = sReadOk
                            ? 0U
                            : std::min( static_cast< uint8_t >( secondaryFailCount_ + 1U ), kFailureThreshold );

        if( pReadOk ) { lastPrimaryMotion_   = pMotion; }
        if( sReadOk ) { lastSecondaryMotion_ = sMotion; }

        /* Both sensors read OK and disagree: increment disagree counter.      */
        /* Both sensors read OK and agree:    reset disagree counter.          */
        /* One or both failed:                counter unchanged this cycle.    */
        if( pReadOk && sReadOk )
        {
            disagreeCount_ = ( pMotion != sMotion )
                             ? std::min( static_cast< uint8_t >( disagreeCount_ + 1U ), kDegradedDisagreeThreshold )
                             : 0U;
        }

        const bool primaryHardFail   { primaryFailCount_   >= kFailureThreshold };
        const bool secondaryHardFail { secondaryFailCount_ >= kFailureThreshold };
        const bool sustained         { disagreeCount_      >= kDegradedDisagreeThreshold };

        SensorHealth health { SensorHealth::TOTAL_FAILURE };

        if( primaryHardFail && secondaryHardFail )
        {
            health = SensorHealth::TOTAL_FAILURE;
        }
        else if( primaryHardFail )
        {
            health = SensorHealth::PRIMARY_FAIL;
        }
        else if( secondaryHardFail )
        {
            health = SensorHealth::SECONDARY_FAIL;
        }
        else if( sustained )
        {
            /* Both responding but disagreeing */
            health = SensorHealth::DEGRADED;
        }
        else
        {
            health = SensorHealth::SYSTEM_OK;
        }

        /* OR fusion — any confirmed detection triggers the output.             */
        /* On partial failure, use the last known value of the failed sensor    */
        /* so a single dropout does not cancel a valid detection.               */
        const bool effectivePrimary   { pReadOk ? pMotion : lastPrimaryMotion_   };
        const bool effectiveSecondary { sReadOk ? sMotion : lastSecondaryMotion_ };

        data.motionDetected = effectivePrimary || effectiveSecondary;
        data.health         = health;

        return ( pReadOk || sReadOk );
    }

} /* namespace mmwave */
