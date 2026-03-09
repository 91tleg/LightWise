#include "fsm_task.hpp"

#include "fsm_manager.hpp"
#include "types/ambient_data.hpp"
#include "types/th_data.hpp"
#include "types/lorawan_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/sensor_health.hpp"
#include "utils/log.h"

namespace fsm
{
    namespace
    {
        constexpr char kTag[] = "FsmTask";
        constexpr uint8_t kDimLevel = 5U;
        constexpr TickType_t kLightTimeoutMs = 3UL * 1000UL;
        constexpr TickType_t kAmbientSamplePeriodMs = 60UL * 1000UL;
    } /* anaonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * params =
            static_cast<TaskParams *>( pvParameters );
        configASSERT( params != nullptr );
        configASSERT( params->ambeintRxQueue != nullptr );
        configASSERT( params->thRxQueue     != nullptr );
        configASSERT( params->thTaskHandle  != nullptr );
        configASSERT( params->lorawanTxQueue != nullptr );
        configASSERT( params->mmwaveRxQueue  != nullptr );
        configASSERT( params->lightTaskHandle != nullptr );

        Manager mgr{};
        Manager::Inputs inputs{};
        Manager::Outputs outputs{};

        TickType_t ambientPollTick = xTaskGetTickCount();
        TickType_t lastMotionTick = 0UL;

        bool isDimmed = false;

        for( ;; )
        {
            /* Wait for motion notification */
            ulTaskNotifyTake( pdTRUE, pdMS_TO_TICKS( 1000U ) );

            const bool motionDetected = ( xQueueReceive( params->mmwaveRxQueue,
                                                         &inputs.mmwave,
                                                         static_cast<TickType_t>( 0U ) ) == pdTRUE );
            if( motionDetected )
            {
                isDimmed = false;
                lastMotionTick = xTaskGetTickCount();

                /* Set light level */
                const BaseType_t notifyResult = xTaskNotify( params->lightTaskHandle,
                                                             outputs.lightLevel,
                                                             eSetValueWithOverwrite );
                LOGI( kTag, "Setting light level to %u: %s",
                      outputs.lightLevel, notifyResult == pdPASS ? "success" : "failed" );

                /* Get temperature and humidity */
                const BaseType_t giveResult = xTaskNotifyGive( params->thTaskHandle );
                LOGI( kTag, "Notifying TH task: %s",
                      giveResult == pdPASS ? "success" : "failed" );
                const BaseType_t thReceiveResult = xQueueReceive( params->thRxQueue,
                                                                  &inputs.th,
                                                                  static_cast<TickType_t>( 100U ) );
                LOGI( kTag, "Receiving TH data: %s",
                      thReceiveResult == pdPASS ? "success" : "failed" );

                outputs = mgr.update( inputs );

                /* Send uplink */
                const BaseType_t uplinkResult = xQueueOverwrite( params->lorawanTxQueue,
                                                                 &outputs.uplinkData );
                LOGI( kTag, "Sending uplink data: %s",
                      uplinkResult == pdPASS ? "success" : "failed" );
            }

            const TickType_t now = xTaskGetTickCount();
            if( ( now - ambientPollTick ) >= pdMS_TO_TICKS( kAmbientSamplePeriodMs ) )
            {
                if( xQueueReceive( params->ambeintRxQueue,
                                   &inputs.ambient, 
                                   0UL ) )
                {
                    LOGI( kTag, "Received ambient data" );
                    outputs = mgr.update(inputs);
                    ambientPollTick = now;
                }
            }

            if( !isDimmed && 
                ( ( now - lastMotionTick ) >= pdMS_TO_TICKS( kLightTimeoutMs  ) ) )
            {
                /* Dim */
                const BaseType_t dimResult = xTaskNotify( params->lightTaskHandle,
                                                          kDimLevel,
                                                          eSetValueWithOverwrite );
                LOGI( kTag, "Dimming light to %u: %s",
                      kDimLevel, dimResult == pdPASS ? "success" : "failed" );
                isDimmed = true;
            }

            vTaskDelay( pdMS_TO_TICKS( 10UL ) );
        }
    }

} /* namespace fsm */
