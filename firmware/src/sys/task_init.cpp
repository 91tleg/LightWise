/**
 * @file  src/init/task_init.cpp
 * @brief FreeRTOS queue and task creation.
 * 
 * @section Construction order
 *  All QueueHandle_t and TaskHandle_t values are nullptr until assigned
 *  inside init().  TaskParams structs hold references and handles — they
 *  must be constructed AFTER the handles they reference are valid.
 *
 *  TaskParams are therefore declared as std::optional and emplaced inline
 *  inside init() immediately after their dependencies exist.
 */

#include "task_init.hpp"

#include <optional>

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

#include "sys/manager_init.hpp"

#include "modules/ambient/ambient_task.hpp"
#include "modules/fsm/fsm_task.hpp"
#include "modules/light/light_task.hpp"
#include "modules/lorawan/lorawan_task.hpp"
#include "modules/mmwave/mmwave_task.hpp"
#include "modules/th/th_task.hpp"

#include "types/ambient_data.hpp"
#include "types/lorawan_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"

#include "utils/log/log.h"

namespace task
{

    namespace
    {

        constexpr char kTag[] { "TaskInit" };

        /* Queue configuration */
        static constexpr uint32_t kAmbientQueueLength  { 1U };
        static constexpr uint32_t kThQueueLength       { 8U };
        static constexpr uint32_t kMmwaveQueueLength   { 1U };
        static constexpr uint32_t kLorawanQueueLength  { 1U };

        /* Stack sizes (bytes) */
        static constexpr uint32_t kAmbientStackSize    { 4096U };
        static constexpr uint32_t kThStackSize         { 2048U };
        static constexpr uint32_t kFsmStackSize        { 4096U };
        static constexpr uint32_t kLightStackSize      { 2048U };
        static constexpr uint32_t kLorawanStackSize    { 8192U };
        static constexpr uint32_t kMmwaveStackSize     { 4096U };

        /* Task priorities */
        static constexpr UBaseType_t kAmbientPriority  { 6U };
        static constexpr UBaseType_t kThPriority       { 6U };
        static constexpr UBaseType_t kFsmPriority      { 2U };
        static constexpr UBaseType_t kLightPriority    { 5U };
        static constexpr UBaseType_t kLorawanPriority  { 6U };
        static constexpr UBaseType_t kMmwavePriority   { 1U };

        /* Queue static storage */
        static StaticQueue_t xAmbientQueueBuffer;
        static StaticQueue_t xThQueueBuffer;
        static StaticQueue_t xMmwaveQueueBuffer;
        static StaticQueue_t xLorawanQueueBuffer;

        static uint8_t ucAmbientQueueStorage[ kAmbientQueueLength * sizeof( ambient::Data ) ];
        static uint8_t ucThQueueStorage[ kThQueueLength * sizeof( th::Data ) ];
        static uint8_t ucMmwaveQueueStorage[ kMmwaveQueueLength * sizeof( mmwave::Data ) ];
        static uint8_t ucLorawanQueueStorage[ kLorawanQueueLength * sizeof( lorawan::UplinkData ) ];

        /* Queue handles */
        static QueueHandle_t xAmbientQueueHandle { nullptr };
        static QueueHandle_t xThQueueHandle { nullptr };
        static QueueHandle_t xMmwaveQueueHandle { nullptr };
        static QueueHandle_t xLorawanQueueHandle { nullptr };

        /* Task TCBs and stacks */
        static StaticTask_t xAmbientTaskTcb;
        static StaticTask_t xThTaskTcb;
        static StaticTask_t xFsmTaskTcb;
        static StaticTask_t xLightTaskTcb;
        static StaticTask_t xLorawanUplinkTaskTcb;
        static StaticTask_t xLorawanDownlinkTaskTcb;
        static StaticTask_t xMmwaveTaskTcb;

        static StackType_t xAmbientStack[ kAmbientStackSize ];
        static StackType_t xThStack[ kThStackSize ];
        static StackType_t xFsmStack[ kFsmStackSize ];
        static StackType_t xLightStack[ kLightStackSize ];
        static StackType_t xLorawanUplinkStack[ kLorawanStackSize ];
        static StackType_t xLorawanDownlinkStack[ kLorawanStackSize ];
        static StackType_t xMmwaveStack[ kMmwaveStackSize ];

        /* Task handles */
        static TaskHandle_t xAmbientTaskHandle { nullptr };
        static TaskHandle_t xThTaskHandle { nullptr };
        static TaskHandle_t xFsmTaskHandle { nullptr };
        static TaskHandle_t xLightTaskHandle { nullptr };
        static TaskHandle_t xLorawanUplinkTaskHandle { nullptr };
        static TaskHandle_t xLorawanDownlinkTaskHandle { nullptr };
        static TaskHandle_t xMmwaveTaskHandle { nullptr };

        /* TaskParams( emplaced inside init() after handles are valid ) */
        static std::optional< ambient::TaskParams > xAmbientTaskParams;
        static std::optional< th::TaskParams > xThTaskParams;
        static std::optional< fsm::TaskParams > xFsmTaskParams;
        static std::optional< light::TaskParams > xLightTaskParams;
        static std::optional< lorawan::UplinkTaskParams > xLorawanUplinkTaskParams;
        static std::optional< mmwave::TaskParams > xMmwaveTaskParams;

    } /* anonymous namespace */

    void init()
    {
        /* Create all queues */
        xAmbientQueueHandle = xQueueCreateStatic( kAmbientQueueLength,
                                                  sizeof( ambient::Data ),
                                                  ucAmbientQueueStorage,
                                                  &xAmbientQueueBuffer );
        configASSERT( xAmbientQueueHandle != nullptr );

        xThQueueHandle = xQueueCreateStatic( kThQueueLength,
                                             sizeof( th::Data ),
                                             ucThQueueStorage,
                                             &xThQueueBuffer );
        configASSERT( xThQueueHandle != nullptr );

        xMmwaveQueueHandle = xQueueCreateStatic( kMmwaveQueueLength,
                                                 sizeof( mmwave::Data ),
                                                 ucMmwaveQueueStorage,
                                                 &xMmwaveQueueBuffer );
        configASSERT( xMmwaveQueueHandle != nullptr );

        xLorawanQueueHandle = xQueueCreateStatic( kLorawanQueueLength,
                                                  sizeof( lorawan::UplinkData ),
                                                  ucLorawanQueueStorage,
                                                  &xLorawanQueueBuffer );
        configASSERT( xLorawanQueueHandle != nullptr );

        LOGI( kTag, "Queues created" );

        /* Light task handle needed by FsmTaskParams */
        xLightTaskParams.emplace( mgr::getLightManager() );

        xLightTaskHandle = xTaskCreateStatic( light::task,
                                              "LightTask",
                                              kLightStackSize,
                                              static_cast< void * >( &xLightTaskParams.value() ),
                                              kLightPriority,
                                              xLightStack,
                                              &xLightTaskTcb );
        configASSERT( xLightTaskHandle != nullptr );

        /* TH task handle needed by FsmTaskParams */
        xThTaskParams.emplace( mgr::getThManager(), xThQueueHandle );

        xThTaskHandle = xTaskCreateStatic( th::task,
                                           "ThTask",
                                           kThStackSize,
                                           static_cast< void * >( &xThTaskParams.value() ),
                                           kThPriority,
                                           xThStack,
                                           &xThTaskTcb );
        configASSERT( xThTaskHandle != nullptr );

        /* FSM task needs light + TH handles */
        xFsmTaskParams.emplace( mgr::getFsmManager(),
                                xAmbientQueueHandle,
                                xThQueueHandle,
                                xMmwaveQueueHandle,
                                xLorawanQueueHandle,
                                xThTaskHandle,
                                xLightTaskHandle );

        xFsmTaskHandle = xTaskCreateStatic( fsm::task,
                                            "FsmTask",
                                            kFsmStackSize,
                                            static_cast< void * >( &xFsmTaskParams.value() ),
                                            kFsmPriority,
                                            xFsmStack,
                                            &xFsmTaskTcb );
        configASSERT( xFsmTaskHandle != nullptr );

        /* Ambient task */
        xAmbientTaskParams.emplace( mgr::getAmbientManager(), xAmbientQueueHandle );

        xAmbientTaskHandle = xTaskCreateStatic( ambient::task,
                                                "AmbientTask",
                                                kAmbientStackSize,
                                                static_cast< void * >( &xAmbientTaskParams.value() ),
                                                kAmbientPriority,
                                                xAmbientStack,
                                                &xAmbientTaskTcb );
        configASSERT( xAmbientTaskHandle != nullptr );

        /* mmWave task — needs FSM task handle */
        xMmwaveTaskParams.emplace( mgr::getMmwaveManager(),
                                   xMmwaveQueueHandle,
                                   xFsmTaskHandle );

        xMmwaveTaskHandle = xTaskCreateStatic( mmwave::task,
                                              "MmwaveTask",
                                              kMmwaveStackSize,
                                              static_cast< void * >( &xMmwaveTaskParams.value() ),
                                              kMmwavePriority,
                                              xMmwaveStack,
                                              &xMmwaveTaskTcb );
        configASSERT( xMmwaveTaskHandle != nullptr );

        /* LoRaWAN uplink task */
        xLorawanUplinkTaskParams.emplace( mgr::getLorawanManager(), xLorawanQueueHandle );

        xLorawanUplinkTaskHandle = xTaskCreateStatic( lorawan::uplink_task,
                                                      "LorawanUplinkTask",
                                                      kLorawanStackSize,
                                                      static_cast< void * >( &xLorawanUplinkTaskParams.value() ),
                                                      kLorawanPriority,
                                                      xLorawanUplinkStack,
                                                      &xLorawanUplinkTaskTcb );
        configASSERT( xLorawanUplinkTaskHandle != nullptr );

        LOGI( kTag, "All tasks created" );
    }

} /* namespace task */
