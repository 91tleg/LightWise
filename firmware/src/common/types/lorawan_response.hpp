#ifndef SRC_COMMON_TYPES_LORAWAN_RESPONSE_HPP
#define SRC_COMMON_TYPES_LORAWAN_RESPONSE_HPP

#include <cstdint>

#include "types/lorawan_downlink.hpp"

namespace lorawan
{

    enum class ResponseCode : uint8_t
    {
        Ack  = 0x00U,
        Nack = 0x01U
    };

    enum class ReasonCode : uint8_t
    {
        Ok              = 0x00U,
        InvalidVersion  = 0x01U,
        InvalidCmd      = 0x02U,
        InvalidParam    = 0x03U,
        NvsError        = 0x04U,
        FsmError        = 0x05U,
        PayloadTooShort = 0x06U,
    };

    struct AckNack
    {
        ResponseCode response { ResponseCode::Nack      };
        DownlinkCmd  echoCmd  { DownlinkCmd::ResumeAuto };
        ReasonCode   reason   { ReasonCode::Ok          };
    };

} /* namespace lorawan */

#endif /* SRC_COMMON_TYPES_LORAWAN_RESPONSE_HPP */
