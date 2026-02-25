#include "uplink_payload_v1.hpp"

#include "types/lorawan_data.hpp"

#include <cstddef>
#include <cstdint>

namespace lorawan
{
    size_t UplinkPayloadV1::size() const
    {
        return kSize;
    }

    void UplinkPayloadV1::encode( const UplinkData & data,
                                  uint8_t * outBuf ) const
    {
        if( outBuf != nullptr )
        {
            /* Byte 0: payload version */
            outBuf[ 0 ] = 0x01U;

            /* Bytes 1-2: lux_x10, big-endian */
            outBuf[ 1 ] = static_cast<uint8_t>( ( data.lux_x10 >> 8U ) & 0xFFU );
            outBuf[ 2 ] = static_cast<uint8_t>( data.lux_x10 & 0xFFU );

            /* Byte 3: temperature */
            outBuf[ 3 ] = static_cast<uint8_t>( data.tempC );

            /* Byte 4: humidity */
            outBuf[ 4 ] = data.humidity;

            /* Byte 5: status flags */
            outBuf[ 5 ] = data.flags;

            /* Byte 6: light level */
            outBuf[ 6 ] = data.lightLevel;
        }
    }
} /* namespace lorawan */
