#ifndef SRC_MODULES_LORAWAN_DOWNLINK_VALIDATORS_HPP
#define SRC_MODULES_LORAWAN_DOWNLINK_VALIDATORS_HPP

#include <cstdint>

#include "common/types/lorawan_downlink.hpp"
#include "common/types/lorawan_response.hpp"

namespace lorawan::validators
{

    struct SetLevelsResult
    {
        bool       valid  { false };
        uint8_t    max    { 0U   };
        uint8_t    dim    { 0U   };
        ReasonCode reason { ReasonCode::Ok };
    };

    struct MotionTimeoutResult
    {
        bool       valid     { false };
        uint16_t   timeoutS  { 0U   };
        ReasonCode reason    { ReasonCode::Ok };
    };

    struct OverrideOnResult
    {
        bool       valid  { false };
        uint8_t    level  { 0U   };
        ReasonCode reason { ReasonCode::Ok };
    };

    struct SensitivityResult
    {
        bool       valid       { false };
        uint8_t    sensitivity { 0U   };
        ReasonCode reason      { ReasonCode::Ok };
    };

    struct HeartbeatIntervalResult
    {
        bool       valid        { false };
        uint8_t    intervalMin  { 0U   };
        ReasonCode reason       { ReasonCode::Ok };
    };

    struct TempDimResult
    {
        bool       valid  { false };
        uint8_t    level  { 0U   };
        uint8_t    hours  { 0U   };
        ReasonCode reason { ReasonCode::Ok };
    };

    [[nodiscard]] SetLevelsResult validateSetLevels( const DownlinkPayload & pl ) noexcept;
    [[nodiscard]] MotionTimeoutResult validateMotionTimeout( const DownlinkPayload & pl ) noexcept;
    [[nodiscard]] OverrideOnResult validateOverrideOn( const DownlinkPayload & pl ) noexcept;
    [[nodiscard]] SensitivityResult validateMotionSensitivity( const DownlinkPayload & pl ) noexcept;
    [[nodiscard]] HeartbeatIntervalResult validateHeartbeatInterval( const DownlinkPayload & pl ) noexcept;
    [[nodiscard]] TempDimResult validateTempDim( const DownlinkPayload & pl ) noexcept;

} // namespace lorawan::validators

#endif /* SRC_MODULES_LORAWAN_DOWNLINK_VALIDATORS_HPP */
