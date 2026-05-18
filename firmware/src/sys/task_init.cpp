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
#include "modules/lorawan/uplink_task.hpp"
#include "modules/lorawan/downlink_task.hpp"
#include "modules/lorawan/radio_task.hpp"
#include "modules/mmwave/mmwave_task.hpp"
#include "modules/th/th_task.hpp"

#include "types/ambient_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"
#include "types/lorawan_uplink.hpp"
#include "types/lorawan_downlink.hpp"

#include "utils/log/log.h"

namespace task
{

    namespace
    {

        constexpr char kTag[] { "TaskInit" };

        /* Queue configuration */
        constexpr uint32_t kAmbientQueueLength  { 1U };
        constexpr uint32_t kThQueueLength       { 8U };
        constexpr uint32_t kMmwaveQueueLength   { 1U };
        constexpr uint32_t kLorawanQueueLength  { 1U };
        constexpr uint32_t kFsmCmdQueueLength   { 4U };

        /* Stack sizes (bytes) */
        constexpr uint32_t kAmbientStackSize      { 3072U };
        constexpr uint32_t kThStackSize           { 3072U };
        constexpr uint32_t kFsmStackSize          { 4096U };
        constexpr uint32_t kLightStackSize        { 3072U };
        constexpr uint32_t kLorawanStackSize      { 8192U };
        constexpr uint32_t kMmwaveStackSize       { 3072U };
        constexpr uint32_t kLorawanRadioStackSize { 4096U };

        /* Task priorities */
        constexpr UBaseType_t kAmbientPriority      { 3U };
        constexpr UBaseType_t kThPriority           { 4U };
        constexpr UBaseType_t kFsmPriority          { 2U };
        constexpr UBaseType_t kLightPriority        { 6U };
        constexpr UBaseType_t kLorawanPriority      { 5U };
        constexpr UBaseType_t kMmwavePriority       { 7U };
        constexpr UBaseType_t kLorawanRadioPriority { 8U };

        /* Queue storage */
        StaticQueue_t xAmbientQueueBuffer;
        StaticQueue_t xThQueueBuffer;
        StaticQueue_t xMmwaveQueueBuffer;
        StaticQueue_t xLorawanQueueBuffer;
        StaticQueue_t xFsmCmdQueueBuffer;

        uint8_t ucAmbientQueueStorage[ kAmbientQueueLength * sizeof( ambient::Data ) ];
        uint8_t ucThQueueStorage[ kThQueueLength * sizeof( th::Data ) ];
        uint8_t ucMmwaveQueueStorage[ kMmwaveQueueLength * sizeof( mmwave::Data ) ];
        uint8_t ucLorawanQueueStorage[ kLorawanQueueLength * sizeof( lorawan::UplinkData ) ];
        uint8_t ucFsmCmdQueueStorage[ kFsmCmdQueueLength * sizeof( lorawan::DownlinkEvent ) ];

        /* Queue handles */
        QueueHandle_t xAmbientQueueHandle { nullptr };
        QueueHandle_t xThQueueHandle { nullptr };
        QueueHandle_t xMmwaveQueueHandle { nullptr };
        QueueHandle_t xLorawanQueueHandle { nullptr };
        QueueHandle_t xFsmCmdQueueHandle { nullptr };

        /* Task TCBs and stacks */
        StaticTask_t xAmbientTaskTcb;
        StaticTask_t xThTaskTcb;
        StaticTask_t xFsmTaskTcb;
        StaticTask_t xLightTaskTcb;
        StaticTask_t xLorawanUplinkTaskTcb;
        StaticTask_t xLorawanDownlinkTaskTcb;
        StaticTask_t xMmwaveTaskTcb;
        StaticTask_t xLorawanRadioTaskTcb;

        StackType_t xAmbientStack[ kAmbientStackSize ];
        StackType_t xThStack[ kThStackSize ];
        StackType_t xFsmStack[ kFsmStackSize ];
        StackType_t xLightStack[ kLightStackSize ];
        StackType_t xLorawanUplinkStack[ kLorawanStackSize ];
        StackType_t xLorawanDownlinkStack[ kLorawanStackSize ];
        StackType_t xMmwaveStack[ kMmwaveStackSize ];
        StackType_t xLorawanRadioStack[ kLorawanRadioStackSize ];

        /* Task handles */
        TaskHandle_t xAmbientTaskHandle { nullptr };
        TaskHandle_t xThTaskHandle { nullptr };
        TaskHandle_t xFsmTaskHandle { nullptr };
        TaskHandle_t xLightTaskHandle { nullptr };
        TaskHandle_t xLorawanUplinkTaskHandle { nullptr };
        TaskHandle_t xLorawanDownlinkTaskHandle { nullptr };
        TaskHandle_t xMmwaveTaskHandle { nullptr };
        TaskHandle_t xLorawanRadioTaskHandle { nullptr };

        /* TaskParams( emplaced inside init() after handles are valid ) */
        std::optional< ambient::TaskParams > xAmbientTaskParams;
        std::optional< th::TaskParams > xThTaskParams;
        std::optional< fsm::TaskParams > xFsmTaskParams;
        std::optional< light::TaskParams > xLightTaskParams;
        std::optional< lorawan::UplinkTaskParams > xLorawanUplinkTaskParams;
        std::optional< lorawan::DownlinkTaskParams > xLorawanDownlinkTaskParams;
        std::optional< mmwave::TaskParams > xMmwaveTaskParams;
        std::optional< lorawan::RadioTaskParams > xLorawanRadioTaskParams;
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

        xFsmCmdQueueHandle = xQueueCreateStatic( kFsmCmdQueueLength,
                                                 sizeof( lorawan::DownlinkEvent ),
                                                 ucFsmCmdQueueStorage,
                                                 &xFsmCmdQueueBuffer );
        configASSERT( xFsmCmdQueueHandle != nullptr );

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
                                xFsmCmdQueueHandle,
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
        xLorawanUplinkTaskParams.emplace( mgr::getLorawanManager(),
                                          xLorawanQueueHandle,
                                          mgr::getSystemConfig() );

        xLorawanUplinkTaskHandle = xTaskCreateStatic( lorawan::uplinkTask,
                                                      "LorawanUplinkTask",
                                                      kLorawanStackSize,
                                                      static_cast< void * >( &xLorawanUplinkTaskParams.value() ),
                                                      kLorawanPriority,
                                                      xLorawanUplinkStack,
                                                      &xLorawanUplinkTaskTcb );
        configASSERT( xLorawanUplinkTaskHandle != nullptr );

        /* LoRaWAN downlink task */
        xLorawanDownlinkTaskParams.emplace( mgr::getLorawanManager(),
                                            mgr::getConfigStore(),
                                            mgr::getSystemConfig(),
                                            xFsmCmdQueueHandle );

        xLorawanDownlinkTaskHandle = xTaskCreateStatic( lorawan::downlinkTask,
                                                        "LorawanDownlinkTask",
                                                        kLorawanStackSize,
                                                        static_cast< void * >( &xLorawanDownlinkTaskParams.value() ),
                                                        kLorawanPriority,
                                                        xLorawanDownlinkStack,
                                                        &xLorawanDownlinkTaskTcb );
        configASSERT( xLorawanDownlinkTaskHandle != nullptr );

        xLorawanRadioTaskParams.emplace( mgr::getLorawanManager() );

        xLorawanRadioTaskHandle = xTaskCreateStatic( lorawan::radioTask,
                                                     "LorawanRadioTask",
                                                     kLorawanRadioStackSize,
                                                     static_cast< void * >( &xLorawanRadioTaskParams.value() ),
                                                     kLorawanRadioPriority,
                                                     xLorawanRadioStack,
                                                     &xLorawanRadioTaskTcb );
        configASSERT( xLorawanRadioTaskHandle != nullptr );

        LOGI( kTag, "All tasks created" );
    }

} /* namespace task */
