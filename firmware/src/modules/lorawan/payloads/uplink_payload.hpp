#ifndef SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP

#include <cstdint>
#include <span>

namespace lorawan
{

    struct UplinkData;

    class UplinkPayload
    {
    public:
        virtual ~UplinkPayload() = default;

        /**
         * @brief  Encode UplinkData into a caller-owned buffer.
         *
         * @param  data  Source data structure.
         * @param  buf   Output span of exactly kSize bytes.
         *               Behaviour is undefined if buf.size() < kSize.
         */
        virtual void encode( const UplinkData & data,
                             std::span< uint8_t > buf ) const noexcept = 0;

    protected:
        UplinkPayload()                                   = default;
        UplinkPayload( const UplinkPayload & )            = default;
        UplinkPayload &operator=( const UplinkPayload & ) = default;
        UplinkPayload( UplinkPayload && )                 = default;
        UplinkPayload &operator=( UplinkPayload && )      = default;
    };

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP */
