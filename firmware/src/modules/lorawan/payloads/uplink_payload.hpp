#ifndef SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP

#include <cstddef>
#include <cstdint>

namespace lorawan
{
    struct UplinkData;

    class UplinkPayload
    {
    public:
        virtual ~UplinkPayload() = default;

        virtual size_t size() const = 0;

        virtual void encode( const UplinkData & data,
                             uint8_t * outBuf ) const = 0;
    };
} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_HPP */
