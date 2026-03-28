#ifndef SRC_MODULES_FSM_FSM_TYPES_HPP
#define SRC_MODULES_FSM_FSM_TYPES_HPP

#include <cstdint>

#include "types/lorawan_uplink.hpp"

namespace fsm
{
    enum class State : uint8_t
    {
        AutoOff      = 0U,
        AutoDim      = 1U,
        MotionActive = 2U,
        ManualOn     = 3U,
        ManualOff    = 4U,
        TempDim      = 5U,
        Fault        = 6U
    };

    struct Config
    {
        uint8_t maxLevel     { 100U };
        uint8_t dimLevel     { 30U  };
        uint8_t tempDimLevel { 30U  };
        uint8_t manualLevel  { 100U };
    };

    struct HandlerResult
    {
        State nextState  { State::AutoOff };
        bool  sendUplink { false          };
    };

    struct Outputs
    {
        uint8_t             lightLevel { 0U    };
        bool                sendUplink { false };
        lorawan::UplinkData uplinkData {};
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_TYPES_HPP */
