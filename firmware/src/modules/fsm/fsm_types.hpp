#ifndef SRC_MODULES_FSM_FSM_TYPES_HPP
#define SRC_MODULES_FSM_FSM_TYPES_HPP
 
#include <cstdint>
 
#include "types/lorawan_data.hpp"
#include "types/ambient_data.hpp"
#include "types/lorawan_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"

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

    enum class Event : uint8_t
    {
        PhotocellDark   = 0U,
        PhotocellLight  = 1U,
        MotionDetected  = 2U,
        MotionTimeout   = 3U,
        LoraOverrideOn  = 4U,
        LoraOverrideOff = 5U,
        LoraResumeAuto  = 6U,
        LoraTempDim     = 7U,
        TempDimExpiry   = 8U,
        ManualTimeout   = 9U,
        FaultDetected   = 10U,
        FaultCleared    = 11U
    };

    struct Config
    {
        uint8_t maxLevel     { 100U };
        uint8_t dimLevel     { 30U  };
        uint8_t tempDimLevel { 30U  };
        uint8_t manualLevel  { 100U };
    };

    struct EventData
    {
        float   lux           { 0.0f };
        uint8_t temperature   { 0U   };
        uint8_t humidity      { 0U   };
        uint8_t overrideLevel { 0U   };
        uint8_t tempDimHours  { 0U   };

        /* Sensor health — used by assembleOutputs() to encode UplinkData::flags */
        SensorHealth ambientHealth { SensorHealth::TOTAL_FAILURE };
        SensorHealth mmwaveHealth  { SensorHealth::TOTAL_FAILURE };
        SensorHealth thHealth      { SensorHealth::TOTAL_FAILURE };
    };

    struct HandlerResult
    {
        State nextState  { State::AutoOff };
        bool  sendUplink { false          };
    };

    struct Outputs
    {
        uint8_t              lightLevel { 0U    };
        bool                 sendUplink { false };
        lorawan::UplinkData  uplinkData {};
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_TYPES_HPP */
