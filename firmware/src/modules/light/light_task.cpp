#include "light_task.hpp"

#include <freertos/task.h>

#include "light_manager.hpp"
#include "utils/log.h"

namespace light
{
    namespace
    {
        constexpr char kTag[] = "LightTask";
        constexpr uint32_t kLightOnDurationMs = 30000U;
        constexpr uint8_t kRampStepsPerSecond = 20U;
        constexpr uint8_t kLevelOn = 100U;
        constexpr uint8_t kLevelOff = 0U;
        constexpr uint8_t kStepsPerSecond = 60U;
    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * params = 
            static_cast<TaskParams *>( pvParameters );
        configASSERT( params != nullptr );

        bool lightOn = false;
        uint32_t lightOnTimerMs = 0U;
        Manager mgr( *params->primary, kStepsPerSecond );

        for( ;; )
        {
            TickType_t waitTicks = pdMS_TO_TICKS( 50U );

            if( mgr.isRamping() )
            {
                waitTicks = pdMS_TO_TICKS( mgr.stepIntervalMs() );
            }
            else if( lightOn )
            {
                const uint32_t now = static_cast<uint32_t>( xTaskGetTickCount() ) * 
                                 static_cast<uint32_t>( portTICK_PERIOD_MS );
                const uint32_t elapsed   = ( now >= lightOnTimerMs ) 
                                           ? ( now - lightOnTimerMs ) 
                                           :    0U;
                const uint32_t remaining  = ( elapsed < kLightOnDurationMs )
                                            ? ( kLightOnDurationMs - elapsed )
                                            : 0U;
                waitTicks = pdMS_TO_TICKS( remaining );
            }
            else
            {
                /* No adjustment to waitTicks required */
            }

            uint32_t notifiedValue = 0U;
            if( xTaskNotifyWait( 0U,
                                 0xFFFFFFFFU,
                                 &notifiedValue,
                                 waitTicks ) == pdTRUE )
            {
                const uint8_t level = static_cast<uint8_t>( notifiedValue & 0xFFU );
                lightOnTimerMs = static_cast<uint32_t>( xTaskGetTickCount() ) * 
                                 static_cast<uint32_t>( portTICK_PERIOD_MS );
                
                mgr.setTarget( level, kRampStepsPerSecond );
                lightOn = ( level > kLevelOff );

                LOGD( kTag, "Received notify: %u, target level: %u", 
                      notifiedValue, level );
            }
            else if( lightOn && !mgr.isRamping() )
            {
                mgr.setTarget( kLevelOff, kRampStepsPerSecond );
                lightOn = false;
            }
            else
            {
                /* Nothing to do */
            }

            mgr.step();
        }
    }
} /* namespace light */
