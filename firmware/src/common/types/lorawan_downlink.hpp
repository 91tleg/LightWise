#ifndef SRC_COMMON_TYPES_LORAWAN_DOWNLINK_HPP
#define SRC_COMMON_TYPES_LORAWAN_DOWNLINK_HPP

/**
 * @file  common/types/lorawan_downlink.hpp
 * @brief LoRaWAN downlink command types.
 *
 * @section Downlink payload format (V1 downlink, any uplink version)
 *  Byte 0 : version      = 0x01
 *  Byte 1 : command      (DownlinkCmd enum)
 *  Byte 2+: parameters   (command-specific, see DownlinkCmd docs)
 *
 * @section NVS persistence
 *  Commands marked [NVS] are persisted to NVS by the downlink decoder
 *  so they survive reboot.  Volatile commands take effect immediately
 *  and are cleared on reboot or when RESUME_AUTO is received.
 */

#include <array>
#include <cstdint>

#include "fsm_event.hpp"

namespace lorawan
{

    static constexpr uint8_t kDownlinkVersion   { 0x01U };
    static constexpr uint8_t kDownlinkMinLen    { 2U    };  /* version + cmd */
    static constexpr uint8_t kDownlinkMaxParams { 4U    };

    enum class DownlinkCmd : uint8_t
    {
        SetLevels            = 0x01U,  /**< [NVS] Byte2=maxLevel, Byte3=dimLevel      */
        SetMotionTimeout     = 0x02U,  /**< [NVS] Byte2=hi, Byte3=lo (seconds uint16) */
        OverrideOn           = 0x03U,  /**< Byte2=level (0-100)                       */
        OverrideOff          = 0x04U,  /**< No params                                 */
        ResumeAuto           = 0x05U,  /**< No params                                 */
        RequestUplink        = 0x06U,  /**< No params — triggers immediate telemetry  */
        Reboot               = 0x07U,  /**< No params                                 */
        SetMotionSensitivity = 0x08U,  /**< [NVS] Byte2=sensitivity (0-10)            */
        SetHeartbeatInterval = 0x09U,  /**< [NVS] Byte2=interval_minutes              */
        SetTempDim           = 0x0AU,  /**< Byte2=level (0-100), Byte3=duration_hours */
    };

    struct DownlinkPayload
    {
        uint8_t version { 0U };
        DownlinkCmd cmd { DownlinkCmd::ResumeAuto };
        std::array< uint8_t, kDownlinkMaxParams > params {};
        uint8_t paramLen{ 0U };
    };

    struct DownlinkEvent
    {
        fsm::Event     event { fsm::Event::LoraResumeAuto };
        fsm::EventData data  {};
    };

} /* namespace lorawan */

#endif /* SRC_COMMON_TYPES_LORAWAN_DOWNLINK_HPP */
