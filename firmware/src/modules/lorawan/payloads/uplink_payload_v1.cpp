#include "uplink_payload_v1.hpp"

#include <cassert>

#include "types/lorawan_data.hpp"

namespace lorawan
{

    void UplinkPayloadV1::encode( const UplinkData & data,
                                  std::span< uint8_t > buf ) const noexcept
    {
        assert( buf.size() >= kSize );

        buf[ 0 ] = 0x01U;
        buf[ 1 ] = static_cast< uint8_t >( ( data.lux_x10 >> 8U ) & 0xFFU );
        buf[ 2 ] = static_cast< uint8_t >( data.lux_x10 & 0xFFU );
        buf[ 3 ] = static_cast< uint8_t >( data.tempC );
        buf[ 4 ] = data.humidity;
        buf[ 5 ] = data.flags;
        buf[ 6 ] = data.lightLevel;
    }

} /* namespace lorawan */
