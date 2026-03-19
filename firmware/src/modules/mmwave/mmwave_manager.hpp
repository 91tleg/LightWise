/**
 * @file  src/modules/mmwave/mmwave_manager.hpp
 * @brief Dual mmWave presence sensor manager with cross-check and hysteresis.
 *
 * @section Health classification (owned by Manager, acted on by FSM task)
 *  Manager classifies health per update() call and exposes it via
 *  data.health.  The FSM task acts on the health verdict — it owns
 *  reconnect retry, safe-state transitions, and light-level decisions.
 *  Manager does not retry connections at runtime.
 *
 * @section Consistency check with hysteresis
 *  A single disagreement between sensors does not trigger DEGRADED —
 *  mmWave sensors stream presence data and brief one-cycle divergence
 *  is expected (different field-of-view, micro-movement detection).
 *
 *  disagreeCount_ is incremented on each cycle where both sensors
 *  read successfully but report different results. It is reset to
 *  zero on any cycle where both sensors agree. DEGRADED is set when
 *  disagreeCount_ reaches kDegradedDisagreeThreshold.
 *
 *  failureCount_ per sensor tracks consecutive read failures.
 *  DEGRADED is set when either count reaches kDegradedFailureThreshold
 *  but remains below kFailureThreshold. PRIMARY_FAIL / SECONDARY_FAIL
 *  is set when a count reaches kFailureThreshold.
 */

#ifndef SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP
#define SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP

#include <cstdint>
#include <functional>

#include "lib/mmwave/mmwave_sensor.hpp"

namespace mmwave
{

    struct Data;

    class Manager
    {
    public:
        /**
         * @brief  Construct with both sensors injected.
         *
         * @param  primary    Primary mmWave sensor (static lifetime).
         * @param  secondary  Secondary mmWave sensor (static lifetime).
         */
        Manager( MmwaveSensor & primary,
                 MmwaveSensor & secondary ) noexcept;

        ~Manager()                            = default;
        Manager( const Manager & )            = delete;
        Manager &operator=( const Manager & ) = delete;
        Manager( Manager && )                 = delete;
        Manager &operator=( Manager && )      = delete;

        /**
         * @brief  Connect and configure both sensors.
         *
         * Attempts connection up to kMaxConnectAttempts times per sensor.
         * Returns true only if both sensors connected and configured
         * successfully.  Called once at startup; reconnect on failure is
         * the FSM task's responsibility.
         *
         * @return true  if both sensors are ready.
         * @return false if either sensor failed to connect or configure.
         */
        [[nodiscard]] bool setup() noexcept;

        /**
         * @brief  Read both sensors, classify health, and fuse motion.
         *
         * @param  data  Filled with fused motion result and health status.
         * @return true  if at least one sensor read succeeded.
         * @return false if both reads failed.
         */
        [[nodiscard]] bool update( Data & data ) noexcept;

    private:
        [[nodiscard]] bool setupSensor( MmwaveSensor & sensor,
                                        bool hasKeepSensitivity ) noexcept;

        std::reference_wrapper< MmwaveSensor > primary_;
        std::reference_wrapper< MmwaveSensor > secondary_;

        uint8_t primaryFailCount_   { 0U };
        uint8_t secondaryFailCount_ { 0U };
        uint8_t disagreeCount_      { 0U };

        bool lastPrimaryMotion_   { false };
        bool lastSecondaryMotion_ { false };

        static constexpr Mode     kSensorMode          { Mode::PRESENCE };
        static constexpr uint16_t kDetectionRangeMin   { 30U   };
        static constexpr uint16_t kDetectionRangeMax   { 1000U };
        static constexpr uint16_t kTrigRange           { 1000U };
        static constexpr uint8_t  kTrigSensitivity     { 5U    };
        static constexpr uint8_t  kKeepSensitivity     { 3U    };
        static constexpr uint16_t kTrigDelay           { 100U  };
        static constexpr uint16_t kKeepDelay           { 4U    };
        static constexpr uint8_t  kMaxConnectAttempts  { 5U    };
        static constexpr uint32_t kConnectRetryDelayMs { 1000U };

        static constexpr uint8_t kDegradedFailureThreshold  { 3U };
        static constexpr uint8_t kFailureThreshold          { 10U };
        static constexpr uint8_t kDegradedDisagreeThreshold { 3U };
    };

} /* namespace mmwave */

#endif /* SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP */
