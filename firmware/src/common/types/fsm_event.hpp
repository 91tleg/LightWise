#ifndef SRC_COMMON_TYPES_FSM_EVENT_HPP
#define SRC_COMMON_TYPES_FSM_EVENT_HPP

#include <cstdint>
#include "types/sensor_health.hpp"

namespace fsm
{
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

    /**
     * @brief Data carried with an FSM event.
     *
     * Event parameters (overrideLevel, tempDimHours) are populated
     * by the event source. Sensor telemetry and health fields are
     * updated each cycle by the FSM task from sensor queues and
     * are used by assembleOutputs() for uplink assembly.
     *
     * Only fields relevant to the active event type need to be set —
     * unused fields retain their default values.
     */
    struct EventData
    {
        /* Event parameters */
        uint8_t overrideLevel { 0U }; /**< Light level % (LoraOverrideOn) */
        uint8_t tempDimHours  { 0U }; /**< Duration hours (LoraTempDim)   */

        /* Sensor telemetry */
        float   lux        { 0.0f }; /**< Ambient lux                    */
        int8_t temperature { 0U   }; /**< Temperature °C                 */
        uint8_t humidity   { 0U   }; /**< Relative humidity 0–100 %      */

        /* Sensor health — updated each cycle, used by assembleOutputs() */
        SensorHealth ambientHealth { SensorHealth::TOTAL_FAILURE }; /**< Ambient sensor health */
        SensorHealth mmwaveHealth  { SensorHealth::TOTAL_FAILURE }; /**< mmWave sensor health  */
        SensorHealth thHealth      { SensorHealth::TOTAL_FAILURE }; /**< TH sensor health      */
        bool         lightOk       { false }; /**< Light current sense ok */
    };

} /* namespace fsm */

#endif /* SRC_COMMON_TYPES_FSM_EVENT_HPP */
