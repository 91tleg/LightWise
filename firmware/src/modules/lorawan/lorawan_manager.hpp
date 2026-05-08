#ifndef SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP
#define SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP

/**
 * @file  src/modules/lorawan/lorawan_manager.hpp
 * @brief LoRaWAN connection, uplink, and downlink manager.
 *
 * This file implements the manager for LoRaWAN connectivity, 
 * including join state machine, uplink transmission, and downlink reception.
 *
 * @section Join state machine
 * LoRaWAN join must not block the system — the streetlight must operate
 * regardless of network availability.
 *
 * - setup()           — configures radio, fires first join request, returns
 *                       immediately. State JOINING on success.
 * - tryAdvanceJoin()  — called periodically from the task loop. Polls isJoined();
 *                       if still waiting, re-issues join() after kJoinRetryMs.
 *                       State READY when joined.
 * - isReady()         — gates sendUplink(); uplinks nop until READY.
 *
 * States:
 * UNINITIALIZED → CONFIGURING → JOINING ⇄ (retry) → READY
 *
 * @section MutexSafety Mutex safety
 * device_ is shared between the uplink task and the downlink task.
 * A mutex serialises access. RAII MutexGuard ensures the lock is always released.
 */

#include <cstdint>
#include <span>

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

#include "lib/lorawan/lorawan_sensor.hpp"

namespace lorawan
{

    class Keys;

    class Manager
    {
    public:
        enum class State : uint8_t
        {
            UNINITIALIZED = 0U,
            CONFIGURING   = 1U,
            JOINING       = 2U,
            READY         = 3U
        };

        /**
         * @brief  Construct with all dependencies injected.
         *
         * @param  device LoRaWAN radio driver (static lifetime).
         */
        Manager( LorawanSensor & device ) noexcept;

        ~Manager()                             = default;
        Manager( const Manager & )             = delete;
        Manager & operator=( const Manager & ) = delete;
        Manager( Manager && )                  = delete;
        Manager & operator=( Manager && )      = delete;

        /**
         * @brief  Configure the radio and fire the first join request.
         *
         * Non-blocking — returns immediately after issuing join().
         * Call tryAdvanceJoin() periodically from the task loop.
         *
         * @return true  if all config steps succeeded and join was issued.
         * @return false if any config step failed (state → FAILED).
         */
        [[nodiscard]] bool setup( const Keys & keys, uint32_t nowMs ) noexcept;

        /**
         * @brief  Poll join state; re-issue join request after kJoinRetryMs.
         *
         * Safe to call regardless of current state — no-op if READY or FAILED.
         * Tracks elapsed time internally; re-issues join() if the network has
         * not responded within kJoinRetryMs (handles silent rejection).
         *
         * @param  nowMs  Current time in milliseconds (e.g. esp_timer_get_time
         *                / 1000, or xTaskGetTickCount * portTICK_PERIOD_MS).
         * @return true   if now READY.
         */
        [[nodiscard]] bool tryAdvanceJoin( uint32_t nowMs ) noexcept;

        /**
         * @brief  Return true if the network is joined and uplinks may be sent.
         */
        [[nodiscard]] bool isReady() const noexcept;

        /**
         * @brief  Return current join/config state.
         */
        [[nodiscard]] State state() const noexcept;

        /**
         * @brief  Register a callback for received downlink packets.
         *
         * Thin pass-through to the device driver.  Call once at task startup
         * before pollReceive() — no mutex needed (single-threaded at init time).
         *
         * @param  cb  Callback function from LorawanSensor::RxCallback.
         */
        void setRxCb( LorawanSensor::RxCallback cb ) noexcept;

        /**
         * @brief  Transmit a raw packet.
         *
         * No-ops and returns false if not READY.
         * Thread-safe — acquires the device mutex.
         *
         * @param  buf   Bytes.
         * @return true  if the packet was accepted by the radio.
         */
        [[nodiscard]] bool send( std::span< const uint8_t > buf ) noexcept;

    private:

        /**
         * @brief RAII mutex guard 
         */
        class MutexGuard
        {
        public:
            explicit MutexGuard( SemaphoreHandle_t mutex ) noexcept
                : mutex_  { mutex }
                , locked_ { xSemaphoreTake( mutex, portMAX_DELAY ) == pdTRUE }
            {

            }

            ~MutexGuard() noexcept
            {
                if( locked_ )
                {
                    static_cast< void >( xSemaphoreGive( mutex_ ) );
                }
            }

            [[nodiscard]] bool locked() const noexcept { return locked_; }

            MutexGuard( const MutexGuard & )             = delete;
            MutexGuard & operator=( const MutexGuard & ) = delete;
            MutexGuard( MutexGuard && )                  = delete;
            MutexGuard & operator=( MutexGuard && )      = delete;

        private:
            SemaphoreHandle_t mutex_;
            bool locked_;
        };

        [[nodiscard]] bool configure() noexcept;
        [[nodiscard]] bool issueJoin( uint32_t nowMs ) noexcept;

        LorawanSensor & device_;

        StaticSemaphore_t mutexBuffer_;
        SemaphoreHandle_t mutex_;

        State state_ { State::UNINITIALIZED };
        uint32_t lastJoinMs_ { 0U };

        static constexpr uint32_t kSetupDelayMs { 300U  };
        static constexpr uint32_t kJoinRetryMs  { 5000U };

        static constexpr LorawanSensor::Region      kRegion      { LorawanSensor::Region::US915           };
        static constexpr LorawanSensor::DeviceClass kDeviceClass { LorawanSensor::DeviceClass::C          };
        static constexpr LorawanSensor::PacketType  kPacketType  { LorawanSensor::PacketType::UNCONFIRMED };
        static constexpr uint8_t kDatarate    { 3U    };
        static constexpr uint8_t kEirp        { 16U   };
        static constexpr uint8_t kSubband     { 2U    };
        static constexpr bool    kAdrEnabled  { false };
    };

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP */
