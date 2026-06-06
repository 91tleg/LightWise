#include "light_task.hpp"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include "light_manager.hpp"
#include "common/types/sensor_health.hpp"
#include "utils/log/log.h"

namespace light
{

    namespace
    {

        constexpr char kTag[] { "LightTask" };
        constexpr uint8_t  kRampStepsPerSecond { 20U };
        constexpr uint32_t kLevelMask    { 0x000000FFU };
        constexpr uint32_t kClearAllBits { 0xFFFFFFFFU };

    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );

        TaskParams & params { *static_cast< TaskParams * >( pvParameters ) };

        configASSERT( params.ledQueue != nullptr );

        bool lastPresent { true };

        for( ;; )
        {
            /* Block until FSM sends a new level, or until next ramp step. */
            const TickType_t waitTicks { params.manager.isRamping()
                                         ? pdMS_TO_TICKS( params.manager.stepIntervalMs() )
                                         : portMAX_DELAY };

            uint32_t notifiedValue { 0U };

            if( xTaskNotifyWait( 0U,
                                 kClearAllBits,
                                 &notifiedValue,
                                 waitTicks ) == pdTRUE )
            {
                const uint8_t level { static_cast< uint8_t >( notifiedValue & kLevelMask ) };

                params.manager.setTarget( level, kRampStepsPerSecond );

                LOGD( kTag, "Target level: %u", static_cast< unsigned >( level ) );
            }

            const bool rampComplete { params.manager.step() };

            if( rampComplete )
            {
                LOGD( kTag, "Ramp complete at level: %u",
                    static_cast< unsigned >( params.manager.getTarget() ) );

                if( params.manager.getTarget() == 100U )
                {
                    const bool present { params.manager.isPresent() };
                    lastPresent = present;
                    static_cast< void >( xQueueOverwrite( params.ledQueue, &present ) );
                    LOGI( kTag, "LED present: %s", present ? "yes" : "no" );
                }
            }
        }
    }

} /* namespace light */
