#include "mmwave_manager.hpp"
#include "lib/mmwave/mmwave_sensor.hpp"
#include "hal/c4001.h"
#include "utils/log.h"

namespace mmwave
{
    namespace
    {
        constexpr char kTag[]                 = "MmwaveManager";
        constexpr Mode kSensorMode            = Mode::PRESENCE;
        constexpr uint16_t kDetectionRangeMin = 30U;
        constexpr uint16_t kDetectionRangeMax = 1000U;
        constexpr uint16_t kTrigRange         = 1000U;
        constexpr uint8_t kTrigSensitivity    = 1U;
        constexpr uint8_t kKeepSensitivity    = 2U;
        constexpr uint8_t kMaxConnectAttempts = 10U;
        constexpr uint8_t kConnectRetryDelay  = 1000U;
        constexpr uint8_t kDegradedFailureThreshold = 3U;

    } /* anonymous namespace */

    Manager::Manager( MmwaveSensor * primary,
                      MmwaveSensor * secondary )
        : primary_( primary ),
        secondary_( secondary ),
        primaryFailureCount_( 0U ),
        secondaryFailureCount_( 0U ),
        lastPrimaryMotion_( false ),
        lastSecondaryMotion_( false )
    {
        LOGI( kTag, "Created. primary: %s, secondary: %s",
              primary_   ? "present" : "absent",
              secondary_ ? "present" : "absent" );
    }

    bool Manager::setup()
    {
        bool result = true;

        if( primary_ != nullptr )
        {
            for( uint8_t attempt = 0; attempt < kMaxConnectAttempts; ++attempt )
            {
                result = false;
                if( primary_->connect() )
                {
                    LOGI( kTag, "Primary connected" );
                    result = true;
                    break;
                }
                LOGI( kTag, "Primary connect retry %d", attempt ); 
                c4001_hal_delay_ms( kConnectRetryDelay );
            }
            result &= primary_->connect();
            result &= primary_->setSensorMode( kSensorMode );
            result &= primary_->setDetectionRange( kDetectionRangeMin, 
                                                   kDetectionRangeMax, 
                                                   kTrigRange );
            result &= primary_->setTrigSensitivity( kTrigSensitivity );
            result &= primary_->setDelay( 100U, 4U );

            LOGI( kTag, "Primary setup: %s", result ? "success" : "failed" );
        }
        else
        {
            result = false;
        }

        if( secondary_ != nullptr )
        {
            for( uint8_t attempt = 0; attempt < kMaxConnectAttempts; ++attempt )
            {
                result = false;
                if( secondary_->connect() )
                {
                    LOGI( kTag, "Secondary connected" );
                    result = true;
                    break;
                }
                c4001_hal_delay_ms( kConnectRetryDelay );
            }
            result &= secondary_->setSensorMode( kSensorMode );
            result &= secondary_->setDetectionRange( kDetectionRangeMin, 
                                                     kDetectionRangeMax, 
                                                     kTrigRange );
            result &= secondary_->setTrigSensitivity( kTrigSensitivity );
            result &= secondary_->setKeepSensitivity( kKeepSensitivity );
            result &= secondary_->setDelay( 100U, 4U );

            LOGI( kTag, "Secondary setup: %s", result ? "success" : "failed" );
        }
        else
        {
            result = false;
        }

        return result;
    }

    bool Manager::update( Data & data )
    {
        bool result = false;

        bool primaryOk   = false;
        bool secondaryOk = false;

        bool pReadOk = false;
        bool sReadOk = false;

        bool pMotion = false;
        bool sMotion = false;

        /* Default output */
        data.motionDetected = false;
        data.health         = SensorHealth::TOTAL_FAILURE;

        /* Sanity: at least one sensor must exist */
        if( ( primary_ != nullptr ) || ( secondary_ != nullptr ) )
        {
            bool pReadOk = false;
            bool sReadOk = false;
            bool pMotion = false;
            bool sMotion = false;

            if( primary_ != nullptr )
            {
                pReadOk = primary_->motionDetected( pMotion );
                if( pReadOk )
                {
                    primaryFailureCount_ = 0U;
                    lastPrimaryMotion_   = pMotion;
                }
                else
                {
                    ++primaryFailureCount_;
                }
            }

            if( secondary_ != nullptr )
            {
                sReadOk = secondary_->motionDetected( sMotion );
                if( sReadOk )
                {
                    secondaryFailureCount_ = 0U;
                    lastSecondaryMotion_   = sMotion;
                }
                else
                {
                    ++secondaryFailureCount_;
                }
            }

            /* Health */
            const bool primaryOk   = ( primary_   == nullptr ) || pReadOk;
            const bool secondaryOk = ( secondary_ == nullptr ) || sReadOk;

            if( primaryOk && secondaryOk )
            {
                data.health = SensorHealth::SYSTEM_OK;
            }
            else if( ( !primaryOk ) && secondaryOk )
            {
                data.health = SensorHealth::PRIMARY_FAIL;
            }
            else if( primaryOk && ( !secondaryOk ) )
            {
                data.health = SensorHealth::SECONDARY_FAIL;
            }
            else
            {
                data.health = SensorHealth::TOTAL_FAILURE;
            }

            /* Motion reads */
            if( primaryOk )
            {
                pReadOk = primary_->motionDetected( pMotion );
                if( pReadOk )
                {
                    lastPrimaryMotion_ = pMotion;
                }
            }

            if( secondaryOk )
            {
                sReadOk = secondary_->motionDetected( sMotion );
                if( sReadOk )
                {
                    lastSecondaryMotion_ = sMotion;
                }
            }

            /* Fuse motion */
            if( ( pReadOk && pMotion ) || ( sReadOk && sMotion ) )
            {
                data.motionDetected = true;
            }

            result = ( pReadOk || sReadOk );

            /* Degraded logic */
            if( data.health == SensorHealth::SYSTEM_OK )
            {
                /* Hard degradation from disagreement / skew */
                bool degraded = false;

                /* Disagreement */
                if( pReadOk && sReadOk && ( pMotion != sMotion ) )
                {
                    degraded = true;
                }

                /* One-cycle skew disagreement */
                if( ( pReadOk && ( !sReadOk ) && ( pMotion != lastSecondaryMotion_ ) ) ||
                    ( sReadOk && ( !pReadOk ) && ( sMotion != lastPrimaryMotion_ ) ) )
                {
                    degraded = true;
                }

                if( degraded )
                {
                    data.health = SensorHealth::DEGRADED;
                }
            } /* end hard degradation */

            /* Soft degradation from instability */
            {
                if( ( primaryFailureCount_   > 0U && primaryFailureCount_   <= kDegradedFailureThreshold ) ||
                    ( secondaryFailureCount_ > 0U && secondaryFailureCount_ <= kDegradedFailureThreshold ) )
                {
                    if( data.health != SensorHealth::TOTAL_FAILURE )
                    {
                        data.health = SensorHealth::DEGRADED;
                    }
                }
            } /* end soft degradation */
        }

        return result;
    }
} /* namespace mmwave */
