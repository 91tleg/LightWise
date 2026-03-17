/**
 * @file  src/modules/fsm/fsm_manager.hpp
 * @brief Finite state machine manager.
 *
 * @section Strategy pattern
 *  Each FSM state has a dedicated Handler implementation.
 *  Manager owns a handler table indexed by State enum value.
 *  process() dispatches to the correct handler, then assembles
 *  Outputs from the HandlerResult.
 *
 *  Adding a new state requires:
 *    1. Add entry to State enum (fsm_types.hpp)
 *    2. Add a new XHandler class (state_handlers.hpp/.cpp)
 *    3. Add one line to the handler table in fsm_manager.cpp
 *
 * @section Runtime Config
 *  maxLevel, dimLevel, manualLevel, tempDimLevel are held in a
 *  Config struct member. Downlink commands update Config via
 *  setConfig(). All handlers receive Config& and may mutate
 *  manualLevel / tempDimLevel in response to override events.
 */
#ifndef SRC_MODULES_FSM_FSM_MANAGER_HPP
#define SRC_MODULES_FSM_FSM_MANAGER_HPP

#include <array>
#include <cstdint>
#include <functional>  /* std::reference_wrapper */

#include "fsm_types.hpp"
#include "handlers/state_handlers.hpp"

namespace fsm
{

    class Manager
    {
    public:
        Manager() noexcept;

        ~Manager()                            = default;
        Manager( const Manager & )            = delete;
        Manager &operator=( const Manager & ) = delete;
        Manager( Manager && )                 = delete;
        Manager &operator=( Manager && )      = delete;

        /**
         * @brief  Reset FSM to initial state (AutoOff, default config).
         */
        void init() noexcept;

        /**
         * @brief  Process one event and return outputs for dispatch.
         *
         * @param  event  The triggering event.
         * @param  data   Sensor data associated with the event.
         * @return Outputs containing light level, uplink flag, and uplink data.
         */
        [[nodiscard]] Outputs process( Event event,
                                       const EventData & data ) noexcept;

        /**
         * @brief  Return the current FSM state.
         */
        [[nodiscard]] State currentState() const noexcept;

        /**
         * @brief  Update runtime level configuration (e.g. from LoRa command).
         *
         * @param  config  New configuration to apply.
         */
        void setConfig( const Config & config ) noexcept;

        /**
         * @brief  Read current level configuration.
         */
        [[nodiscard]] const Config & config() const noexcept;

    private:
        AutoOffHandler      autoOffHandler_;
        AutoDimHandler      autoDimHandler_;
        MotionActiveHandler motionActiveHandler_;
        ManualOnHandler     manualOnHandler_;
        ManualOffHandler    manualOffHandler_;
        TempDimHandler      tempDimHandler_;
        FaultHandler        faultHandler_;

        static constexpr uint8_t kStateCount { 7U };

        std::array< Handler *, kStateCount > handlers_;

        State  state_  { State::AutoOff };
        Config config_ {};

        [[nodiscard]] uint8_t levelForState( State state ) const noexcept;
        [[nodiscard]] Outputs assembleOutputs( State next,
                                               const EventData & data,
                                               bool sendUplink ) const noexcept;
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_MANAGER_HPP */
