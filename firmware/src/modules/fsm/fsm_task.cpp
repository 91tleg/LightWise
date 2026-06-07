#include "fsm_task.hpp"

#include <freertos/timers.h>

#include "types/ambient_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"
#include "types/lorawan_downlink.hpp"
#include "fsm_manager.hpp"
#include "utils/log/log.h"

namespace fsm
{

    namespace
    {

        constexpr char kTag[] { "FsmTask" };
        constexpr uint32_t kMotionTimeoutMs       { 30UL * 1000UL              };
        constexpr uint32_t kManualTimeoutMs       { 8UL * 60UL * 60UL * 1000UL };
        constexpr uint32_t kAmbientSamplePeriodMs { 15UL * 1000UL              };
        constexpr uint32_t kThReceiveTimeoutMs    { 100U                       };
        constexpr uint32_t kQueueReceiveTimeoutMs { 1000U                      };
        constexpr uint32_t kClearAllBits          { 0xFFFFFFFFU                };

        /* Timer callbacks cannot carry context, store task handle at init. */
        TaskHandle_t  sFsmTaskHandle  { nullptr };
        TimerHandle_t sMotionTimer    { nullptr };
        TimerHandle_t sManualTimer    { nullptr };
        StaticTimer_t sMotionTimerBuf {};
        StaticTimer_t sManualTimerBuf {};

        void onMotionTimeout( TimerHandle_t ) noexcept
        {
            if( sFsmTaskHandle != nullptr )
            {
                static_cast< void >(
                    xTaskNotify( sFsmTaskHandle,
                                 static_cast< uint32_t >( Event::MotionTimeout ),
                                 eSetValueWithOverwrite ) );
            }
        }

        void onManualTimeout( TimerHandle_t ) noexcept
        {
            if( sFsmTaskHandle != nullptr )
            {
                static_cast< void >(
                    xTaskNotify( sFsmTaskHandle,
                                 static_cast< uint32_t >( Event::ManualTimeout ),
                                 eSetValueWithOverwrite ) );
            }
        }

        void startMotionTimer() noexcept
        {
            if( sMotionTimer != nullptr )
            {
                static_cast< void >( xTimerReset( sMotionTimer, 0U ) );
            }
        }

        void stopMotionTimer() noexcept
        {
            if( sMotionTimer != nullptr )
            {
                static_cast< void >( xTimerStop( sMotionTimer, 0U ) );
            }
        }

        void startManualTimer() noexcept
        {
            if( sManualTimer != nullptr )
            {
                static_cast< void >( xTimerReset( sManualTimer, 0U ) );
            }
        }

        void stopManualTimer() noexcept
        {
            if( sManualTimer != nullptr )
            {
                static_cast< void >( xTimerStop( sManualTimer, 0U ) );
            }
        }

        void handleTimers( State previous, State next ) noexcept
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

        void dispatchOutputs( const Outputs & outputs,
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
            }
        }

        [[nodiscard]] EventData makeEventData( const ambient::Data & ambient,
                                               const th::Data & th,
                                               const mmwave::Data & mmwave,
                                               const bool lightOk ) noexcept
        {
            EventData ed {};
            ed.lux           = ambient.lux;
            ed.temperature   = th.temperature;
            ed.humidity      = th.humidity;
            ed.ambientHealth = ambient.health;
            ed.thHealth      = th.health;
            ed.mmwaveHealth  = mmwave.health;
            ed.lightOk       = lightOk;
            return ed;
        }

        void readTh( TaskParams & params, th::Data & thOut ) noexcept
        {
            static_cast< void >( xTaskNotifyGive( params.thTaskHandle ) );

            const BaseType_t result { xQueueReceive( params.thRxQueue,
                                                     &thOut,
                                                     pdMS_TO_TICKS( kThReceiveTimeoutMs ) ) };
            LOGD( kTag, "TH read: %s", result == pdPASS ? "ok" : "timeout" );
        }

        void pollAmbient( TaskParams & params,
                          Manager & manager,
                          ambient::Data & lastAmbient,
                          TickType_t & lastPollTick,
                          const th::Data & lastTh,
                          const mmwave::Data & lastMmwave,
                          const bool lightOk ) noexcept
        {
            const TickType_t now { xTaskGetTickCount() };

            if( ( now - lastPollTick ) >= pdMS_TO_TICKS( kAmbientSamplePeriodMs ) )
            {
                ambient::Data fresh {};
                if( xQueueReceive( params.ambientRxQueue, &fresh, 0U ) == pdTRUE )
                {
                    lastAmbient  = fresh;
                    lastPollTick = now;

                    const EventData ed { makeEventData( fresh, lastTh, lastMmwave, lightOk ) };
                    const State before { manager.currentState() };

                    const Event event { ( fresh.lux <= 1000.0f )
                                        ? Event::PhotocellDark
                                        : Event::PhotocellLight };

                    const Outputs out { manager.process( event, ed ) };
                    handleTimers( before, manager.currentState() );
                    dispatchOutputs( out, params );
                }
            }
        }

    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );

        TaskParams & params { *static_cast< TaskParams * >( pvParameters ) };

        configASSERT( params.ambientRxQueue  != nullptr );
        configASSERT( params.thRxQueue       != nullptr );
        configASSERT( params.mmwaveRxQueue   != nullptr );
        configASSERT( params.lorawanTxQueue  != nullptr );
        configASSERT( params.thTaskHandle    != nullptr );
        configASSERT( params.lightTaskHandle != nullptr );
        configASSERT( params.ledPresentQueue != nullptr );

        bool          lastLightOk         { true };
        ambient::Data lastAmbient         {};
        th::Data      lastTh              {};
        mmwave::Data  lastMmwave          {};
        TickType_t    lastAmbientPollTick { xTaskGetTickCount() };

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

        for( ;; )
        {
            static_cast< void >( xQueueReceive( params.ledPresentQueue,
                                                &lastLightOk,
                                                0U ) );

            uint32_t notifiedValue { 0U };
            if( xTaskNotifyWait( 0U, kClearAllBits, &notifiedValue,
                                 pdMS_TO_TICKS( kQueueReceiveTimeoutMs ) ) == pdTRUE )
            {
                const Event timerEvent { static_cast< Event >( notifiedValue ) };

                if( ( timerEvent == Event::MotionTimeout ) ||
                    ( timerEvent == Event::ManualTimeout  ) )
                {
                    const EventData ed { makeEventData( lastAmbient, lastTh, lastMmwave, lastLightOk ) };
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

                const EventData ed { makeEventData( lastAmbient, lastTh, lastMmwave, lastLightOk ) };
                const Event event  { mmwave.motionDetected
                                     ? Event::MotionDetected
                                     : Event::MotionTimeout };
                const State   before { params.manager.currentState() };
                const Outputs out    { params.manager.process( event, ed ) };
                handleTimers( before, params.manager.currentState() );
                dispatchOutputs( out, params );
            }

            lorawan::DownlinkEvent dlEvent {};
            while( xQueueReceive( params.fsmCmdQueue, &dlEvent, 0U ) == pdTRUE )
            {
                LOGI( kTag, "Downlink event: %u",
                      static_cast< unsigned >( dlEvent.event ) );

                const State before { params.manager.currentState() };
                const Outputs out  { params.manager.process( dlEvent.event,
                                                             dlEvent.data ) };
                handleTimers( before, params.manager.currentState() );
                dispatchOutputs( out, params );
            }

            pollAmbient( params,
                         params.manager,
                         lastAmbient,
                         lastAmbientPollTick,
                         lastTh,
                         lastMmwave,
                         lastLightOk );
        }
    }

} /* namespace fsm */
