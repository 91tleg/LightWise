#include "downlink_validators.hpp"

namespace lorawan::validators
{

    SetLevelsResult validateSetLevels( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 2U };
        const uint8_t max {
            static_cast< uint8_t >( hasParams ? pl.params[ 0U ] : 0U )
        };
        const uint8_t dim {
            static_cast< uint8_t >( hasParams ? pl.params[ 1U ] : 0U )
        };
        const bool validRange { hasParams &&
                                ( max >= 1U ) && ( max <= 100U ) &&
                                ( dim <= 100U ) && ( dim <= max ) };

        return validRange
            ? SetLevelsResult{ true,  max, dim, ReasonCode::Ok           }
            : SetLevelsResult{ false, 0U,  0U,  ReasonCode::InvalidParam };
    }

    MotionTimeoutResult validateMotionTimeout( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 2U };
        const uint16_t timeout {
            hasParams
                ? static_cast< uint16_t >(
                      ( static_cast< uint16_t >( pl.params[ 0U ] ) << 8U ) |
                        static_cast< uint16_t >( pl.params[ 1U ] ) )
                : uint16_t{ 0U } };
        const bool validRange { hasParams &&
                                ( timeout >= 15U ) && ( timeout <= 3600U ) };

        return validRange
            ? MotionTimeoutResult{ true,  timeout, ReasonCode::Ok           }
            : MotionTimeoutResult{ false, 0U,      ReasonCode::InvalidParam };
    }

    OverrideOnResult validateOverrideOn( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 1U };
        const uint8_t level {
            static_cast< uint8_t >( hasParams ? pl.params[ 0U ] : 0U )
        };
        const bool validRange { hasParams && ( level >= 1U ) && ( level <= 100U ) };

        return validRange
            ? OverrideOnResult{ true,  level, ReasonCode::Ok           }
            : OverrideOnResult{ false, 0U,    ReasonCode::InvalidParam };
    }

    SensitivityResult validateMotionSensitivity( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 1U };
        const uint8_t sensitivity {
            static_cast< uint8_t >( hasParams ? pl.params[ 0U ] : 0U )
        };
        const bool validRange { hasParams &&
                                ( sensitivity >= 1U ) && ( sensitivity <= 10U ) };

        return validRange
            ? SensitivityResult{ true,  sensitivity, ReasonCode::Ok           }
            : SensitivityResult{ false, 0U,          ReasonCode::InvalidParam };
    }

    HeartbeatIntervalResult validateHeartbeatInterval( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 1U };
        const uint8_t interval {
            static_cast< uint8_t >( hasParams ? pl.params[ 0U ] : 0U )
        };
        const bool validRange { hasParams && ( interval >= 1U ) };

        return validRange
            ? HeartbeatIntervalResult{ true,  interval, ReasonCode::Ok           }
            : HeartbeatIntervalResult{ false, 0U,       ReasonCode::InvalidParam };
    }

    TempDimResult validateTempDim( const DownlinkPayload & pl ) noexcept
    {
        const bool hasParams { pl.paramLen >= 2U };
        const uint8_t level {
            static_cast< uint8_t >( hasParams ? pl.params[ 0U ] : 0U )
        };
        const uint8_t hours {
            static_cast< uint8_t >( hasParams ? pl.params[ 1U ] : 0U )
        };

        const bool validRange { hasParams &&
                                ( level <= 100U ) &&
                                ( hours >= 1U ) && ( hours <= 24U ) };

        return validRange
            ? TempDimResult{ true,  level, hours, ReasonCode::Ok           }
            : TempDimResult{ false, 0U,    0U,    ReasonCode::InvalidParam };
    }

} /* namespace lorawan::validators */
