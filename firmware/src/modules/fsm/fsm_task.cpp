#include "fsm_task.hpp"

#include <freertos/timers.h>

#include "types/ambient_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"
#include "fsm_manager.hpp"
#include "utils/log/log.h"

namespace fsm
{

    namespace
    {

        constexpr char kTag[] { "FsmTask" };
        constexpr uint32_t kMotionTimeoutMs       { 30UL * 1000UL              };
        constexpr uint32_t kManualTimeoutMs       { 8UL * 60UL * 60UL * 1000UL };
        constexpr uint32_t kAmbientSamplePeriodMs { 60UL * 1000UL              };
        constexpr uint32_t kThReceiveTimeoutMs    { 100U                       };
        constexpr uint32_t kQueueReceiveTimeoutMs { 1000U                      };
        constexpr uint32_t kClearAllBits          { 0xFFFFFFFFU                };

        /* Timer callbacks cannot carry context, store task handle at init. */
        static TaskHandle_t  sFsmTaskHandle    { nullptr };
        static TimerHandle_t sMotionTimer      { nullptr };
        static TimerHandle_t sManualTimer      { nullptr };
        static StaticTimer_t sMotionTimerBuf   {};
        static StaticTimer_t sManualTimerBuf   {};

        static void onMotionTimeout( TimerHandle_t ) noexcept
        {
            if( sFsmTaskHandle != nullptr )
            {
                static_cast< void >(
                    xTaskNotify( sFsmTaskHandle,
                                 static_cast< uint32_t >( Event::MotionTimeout ),
                                 eSetValueWithOverwrite ) );
            }
        }

        static void onManualTimeout( TimerHandle_t ) noexcept
        {
            if( sFsmTaskHandle != nullptr )
            {
                static_cast< void >(
                    xTaskNotify( sFsmTaskHandle,
                                 static_cast< uint32_t >( Event::ManualTimeout ),
                                 eSetValueWithOverwrite ) );
            }
        }

        static void startMotionTimer() noexcept
        {
            if( sMotionTimer != nullptr )
            {
                static_cast< void >( xTimerReset( sMotionTimer, 0U ) );
            }
        }

        static void stopMotionTimer() noexcept
        {
            if( sMotionTimer != nullptr )
            {
                static_cast< void >( xTimerStop( sMotionTimer, 0U ) );
            }
        }

        static void startManualTimer() noexcept
        {
            if( sManualTimer != nullptr )
            {
                static_cast< void >( xTimerReset( sManualTimer, 0U ) );
            }
        }

        static void stopManualTimer() noexcept
        {
            if( sManualTimer != nullptr )
            {
                static_cast< void >( xTimerStop( sManualTimer, 0U ) );
            }
        }

        static void handleTimers( State previous, State next ) noexcept
        {
            if( next == State::MotionActive )
            {
                startMotionTimer();
            }
            else if( previous == State::MotionActive )
            {
                stopMotionTimer();
            }
            else
            {
                /* No motion timer change. */
            }

            const bool enteringManual { ( next == State::ManualOn ) ||
                                        ( next == State::ManualOff ) };
            const bool leavingManual  { ( previous == State::ManualOn ) ||
                                        ( previous == State::ManualOff ) };

            if( enteringManual )
            {
                startManualTimer();
            }
            else if( leavingManual )
            {
                stopManualTimer();
            }
            else
            {
                /* No manual timer change. */
            }
        }

        static void dispatchOutputs( const Outputs & outputs,
                                     TaskParams & params ) noexcept
        {
            static_cast< void >(
                xTaskNotify( params.lightTaskHandle,
                             static_cast< uint32_t >( outputs.lightLevel ),
                             eSetValueWithOverwrite ) );

            LOGI( kTag, "Light level: %u",
                  static_cast< unsigned >( outputs.lightLevel ) );

            if( outputs.sendUplink )
            {
                static_cast< void >( xQueueOverwrite( params.lorawanTxQueue,
                                                      &outputs.uplinkData ) );
                LOGI( kTag, "Uplink - flags: %d, hum: %d, lvl: %d, lux: %d, temp: %d",
                      outputs.uplinkData.flags,
                      outputs.uplinkData.humidity,
                      outputs.uplinkData.lightLevel,
                      outputs.uplinkData.lux_x10,
                      outputs.uplinkData.tempC );
            }
        }

        static EventData makeEventData( const ambient::Data & ambient,
                                        const th::Data & th,
                                        const mmwave::Data & mmwave ) noexcept
        {
            EventData ed {};
            ed.lux           = ambient.lux;
            ed.temperature   = th.temperature;
            ed.humidity      = th.humidity;
            ed.ambientHealth = ambient.health;
            ed.thHealth      = th.health;
            ed.mmwaveHealth  = mmwave.health;
            return ed;
        }

        static void readTh( TaskParams &params, th::Data & thOut ) noexcept
        {
            static_cast< void >( xTaskNotifyGive( params.thTaskHandle ) );

            const BaseType_t result { xQueueReceive( params.thRxQueue,
                                                     &thOut,
                                                     pdMS_TO_TICKS( kThReceiveTimeoutMs ) ) };
            LOGD( kTag, "TH read: %s", result == pdPASS ? "ok" : "timeout" );
        }

        static void pollAmbient( TaskParams & params,
                                 Manager & manager,
                                 ambient::Data & lastAmbient,
                                 TickType_t & lastPollTick,
                                 const th::Data & lastTh,
                                 const mmwave::Data & lastMmwave ) noexcept
        {
            const TickType_t now { xTaskGetTickCount() };

            if( ( now - lastPollTick ) < pdMS_TO_TICKS( kAmbientSamplePeriodMs ) )
            {
                return;
            }

            ambient::Data fresh {};
            if( xQueueReceive( params.ambientRxQueue, &fresh, 0U ) == pdTRUE )
            {
                lastAmbient  = fresh;
                lastPollTick = now;

                EventData ed { makeEventData( fresh, lastTh, lastMmwave ) };
                const State before { manager.currentState() };

                const Event event { ( fresh.lux <= 1000.0f )
                                    ? Event::PhotocellDark
                                    : Event::PhotocellLight };

                const Outputs out { manager.process( event, ed ) };
                handleTimers( before, manager.currentState() );
                dispatchOutputs( out, params );
            }
        }

    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );

        TaskParams &params { *static_cast< TaskParams * >( pvParameters ) };

        configASSERT( params.ambientRxQueue  != nullptr );
        configASSERT( params.thRxQueue       != nullptr );
        configASSERT( params.mmwaveRxQueue   != nullptr );
        configASSERT( params.lorawanTxQueue  != nullptr );
        configASSERT( params.thTaskHandle    != nullptr );
        configASSERT( params.lightTaskHandle != nullptr );

        sFsmTaskHandle = xTaskGetCurrentTaskHandle();

        sMotionTimer = xTimerCreateStatic( "motion_timer",
                                           pdMS_TO_TICKS( kMotionTimeoutMs ),
                                           pdFALSE,
                                           nullptr,
                                           onMotionTimeout,
                                           &sMotionTimerBuf );

        sManualTimer = xTimerCreateStatic( "manual_timer",
                                           pdMS_TO_TICKS( kManualTimeoutMs ),
                                           pdFALSE,
                                           nullptr,
                                           onManualTimeout,
                                           &sManualTimerBuf );

        configASSERT( sMotionTimer != nullptr );
        configASSERT( sManualTimer != nullptr );

        params.manager.init();

        ambient::Data lastAmbient {};
        th::Data      lastTh      {};
        mmwave::Data  lastMmwave  {};
        TickType_t    lastAmbientPollTick { xTaskGetTickCount() };

        for( ;; )
        {
            uint32_t notifiedValue { 0U };
            if( xTaskNotifyWait( 0U, kClearAllBits, &notifiedValue,
                                 pdMS_TO_TICKS( kQueueReceiveTimeoutMs ) ) == pdTRUE )
            {
                const Event timerEvent { static_cast< Event >( notifiedValue ) };

                if( ( timerEvent == Event::MotionTimeout ) ||
                    ( timerEvent == Event::ManualTimeout  ) )
                {
                    const EventData ed { makeEventData( lastAmbient, lastTh, lastMmwave ) };
                    const State before { params.manager.currentState() };
                    const Outputs out  { params.manager.process( timerEvent, ed ) };
                    handleTimers( before, params.manager.currentState() );
                    dispatchOutputs( out, params );
                }
            }

            mmwave::Data mmwave {};
            if( xQueueReceive( params.mmwaveRxQueue, &mmwave, 0U ) == pdTRUE )
            {
                lastMmwave = mmwave;

                if( mmwave.motionDetected )
                {
                    readTh( params, lastTh );
                }

                const EventData ed { makeEventData( lastAmbient, lastTh, lastMmwave ) };
                const Event event { mmwave.motionDetected
                                    ? Event::MotionDetected
                                    : Event::MotionTimeout };
                const State   before { params.manager.currentState() };
                const Outputs out    { params.manager.process( event, ed ) };
                handleTimers( before, params.manager.currentState() );
                dispatchOutputs( out, params );
            }

            pollAmbient( params,
                         params.manager,
                         lastAmbient,
                         lastAmbientPollTick,
                         lastTh,
                         lastMmwave );
        }
    }

} /* namespace fsm */
