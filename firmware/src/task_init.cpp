#include "task_init.hpp"

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

#include "device_init.hpp"

#include "modules/ambient/ambient_task.hpp"
#include "modules/th/th_task.hpp"
#include "modules/fsm/fsm_task.hpp"
#include "modules/light/light_task.hpp"
#include "modules/lorawan/lorawan_task.hpp"
#include "modules/mmwave/mmwave_task.hpp"
#include "modules/lorawan/payloads/uplink_payload_v1.hpp"

#include "types/ambient_data.hpp"
#include "types/th_data.hpp"
#include "types/lorawan_data.hpp"
#include "types/mmwave_data.hpp"

#define AMBIENT_QUEUE_LENGTH    ( 1U )
#define AMBIENT_STACK_SIZE      ( 4096U )
#define AMBIENT_TASK_PRIORIY    ( 6U )
static StaticQueue_t xAmbientQueueBuffer;
static uint8_t ucAmbientQueueStorage[ AMBIENT_QUEUE_LENGTH * sizeof( ambient::Data ) ];
static StaticTask_t xAmbientTaskTcb;
static StackType_t xAmbientStack[ AMBIENT_STACK_SIZE ];
static QueueHandle_t xAmbientQueueHandle;
static TaskHandle_t xAmbientTaskHandle;
static ambient::TaskParams xAmbientTaskParams;

#define TH_QUEUE_LENGTH       ( 8U )
#define TH_STACK_SIZE         ( 2048U )
#define TH_TASK_PRIORITY      ( 6U )
static StaticQueue_t xThQueueBuffer;
static uint8_t ucThQueueStroage[ TH_QUEUE_LENGTH * sizeof( th::Data ) ];
static StaticTask_t xThTaskTcb;
static StackType_t xThStack[ TH_STACK_SIZE ];
static QueueHandle_t xThQueueHandle;
static TaskHandle_t xThTaskHandle;
static th::TaskParams xThTaskParams;

#define FSM_STACK_SIZE         ( 4096U )
#define FSM_TASK_PRIORITY      ( 2U )
static StaticTask_t xFsmTaskTcb;
static StackType_t xFsmStack[ FSM_STACK_SIZE ];
static TaskHandle_t xFsmTaskHandle;
static fsm::TaskParams xFsmTaskParams;

#define LIGHT_STACK_SIZE       ( 2048U )
#define LIGHT_TASK_PRIORITY    ( 5U )
static StaticTask_t xLightTaskTcb;
static StackType_t xLightStack[ LIGHT_STACK_SIZE ];
static TaskHandle_t xLightTaskHandle;
static light::TaskParams xLightTaskParams;

#define LORAWAN_QUEUE_LENGTH   ( 1U )
#define LORAWAN_STACK_SIZE     ( 8192U )
#define LORAWAN_TASK_PRIORITY  ( 6U )
static StaticQueue_t xLorawanQueueBuffer;
static uint8_t ucLorawanQueueStorage[ LORAWAN_QUEUE_LENGTH * sizeof( lorawan::UplinkData ) ];
static StaticTask_t xLorawanTaskTcb;
static StackType_t xLorawanStack[ LORAWAN_STACK_SIZE ];
static QueueHandle_t xLorawanQueueHandle;
static TaskHandle_t xLorawanTaskHandle;
static lorawan::TaskParams xLorawanTaskParams;
static lorawan::UplinkPayloadV1 payload{};

#define MMWAVE_QUEUE_LENGTH   ( 1U )
#define MMWAVE_STACK_SIZE     ( 4096U )
#define MMWAVE_TASK_PRIORITY  ( 1U )
static StaticQueue_t xMmwaveQueueBuffer;
static uint8_t ucMmwaveQueueStorage[ MMWAVE_QUEUE_LENGTH * sizeof( mmwave::Data ) ];
static StaticTask_t xMmwaveTaskTcb;
static StackType_t xMmwaveStack[ MMWAVE_STACK_SIZE ];
static QueueHandle_t xMmwaveQueueHandle;
static TaskHandle_t xMmwaveTaskHandle;
static mmwave::TaskParams xMmwaveTaskParams;

namespace task
{
    void init()
    {   
        xAmbientQueueHandle = xQueueCreateStatic( AMBIENT_QUEUE_LENGTH,
                                                sizeof( ambient::Data ),
                                                ucAmbientQueueStorage,
                                                &xAmbientQueueBuffer );
        configASSERT( xAmbientQueueHandle != nullptr );

        xThQueueHandle = xQueueCreateStatic( TH_QUEUE_LENGTH,
                                            sizeof( th::Data ),
                                            ucThQueueStroage,
                                            &xThQueueBuffer );
        configASSERT( xThQueueHandle != nullptr );

        xMmwaveQueueHandle = xQueueCreateStatic( MMWAVE_QUEUE_LENGTH,
                                                sizeof( mmwave::Data ),
                                                ucMmwaveQueueStorage,
                                                &xMmwaveQueueBuffer);
        configASSERT( xMmwaveQueueHandle != nullptr );

        xLorawanQueueHandle = xQueueCreateStatic( LORAWAN_QUEUE_LENGTH,
                                                sizeof( lorawan::UplinkData ),
                                                ucLorawanQueueStorage,
                                                &xLorawanQueueBuffer);
        configASSERT( xLorawanQueueHandle != nullptr ); 


        xAmbientTaskParams =
        {
            .primary = &device::xAlsPt19Primary,
            .secondary = &device::xAlsPt19Secondary,
            .queue = xAmbientQueueHandle,
        };
        xAmbientTaskHandle = xTaskCreateStatic( ambient::task,
                                                "AmbientTask",
                                                AMBIENT_STACK_SIZE,
                                                ( void * ) &xAmbientTaskParams,
                                                AMBIENT_TASK_PRIORIY,
                                                xAmbientStack,
                                                &xAmbientTaskTcb );
        configASSERT( xAmbientTaskHandle != nullptr );

        xThTaskParams =
        {
            .primary = &device::xDht11Primary,
            .queue = xThQueueHandle,
        };
        xThTaskHandle = xTaskCreateStatic( th::task,
                                            "DhtTask",
                                            TH_STACK_SIZE,
                                            ( void * ) &xThTaskParams,
                                            TH_TASK_PRIORITY,
                                            xThStack,
                                            &xThTaskTcb );
        configASSERT( xThTaskHandle != nullptr );

        xLightTaskParams =
        {
            .primary = &device::xLed
        };
        xLightTaskHandle = xTaskCreateStatic( light::task,
                                              "LightTask",
                                              LIGHT_STACK_SIZE,
                                              ( void * ) &xLightTaskParams,
                                              LIGHT_TASK_PRIORITY,
                                              xLightStack,
                                              &xLightTaskTcb );
        configASSERT( xLightTaskHandle != nullptr );

        xLorawanTaskParams =
        {
            .payload = &payload,
            .primary = &device::xLwnodePrimary,
            .rxQueue = xLorawanQueueHandle,
        };
        xLorawanTaskHandle = xTaskCreateStatic( lorawan::task,
                                                "LorawanTask",
                                                LORAWAN_STACK_SIZE,
                                                ( void * ) &xLorawanTaskParams,
                                                LORAWAN_TASK_PRIORITY,
                                                xLorawanStack,
                                                &xLorawanTaskTcb );
        configASSERT( xLorawanTaskHandle != nullptr );

        xFsmTaskParams =
        {
            .ambeintRxQueue = xAmbientQueueHandle,
            .thTaskHandle = xThTaskHandle,
            .thRxQueue = xThQueueHandle,
            .lorawanTxQueue = xLorawanQueueHandle,
            .mmwaveRxQueue = xMmwaveQueueHandle,
            .lightTaskHandle = xLightTaskHandle,
        };
        xFsmTaskHandle = xTaskCreateStatic( fsm::task,
                                            "FsmTask",
                                            FSM_STACK_SIZE,
                                            ( void * ) &xFsmTaskParams,
                                            FSM_TASK_PRIORITY,
                                            xFsmStack,
                                            &xFsmTaskTcb );
        configASSERT( xFsmTaskHandle != nullptr );

        xMmwaveTaskParams =
        {
            .primary = &device::xC4001Primary,
            .secondary = &device::xC001Secondary,
            .fsmTaskHandle = xFsmTaskHandle,
            .queue = xMmwaveQueueHandle,
        };
        xMmwaveTaskHandle = xTaskCreateStatic( mmwave::task,
                                              "MmwaveTask",
                                               MMWAVE_STACK_SIZE,
                                               ( void * ) &xMmwaveTaskParams,
                                               MMWAVE_TASK_PRIORITY,
                                               xMmwaveStack,
                                               &xMmwaveTaskTcb );
        configASSERT( xMmwaveTaskHandle != nullptr );
    }
} /* namespace task */
