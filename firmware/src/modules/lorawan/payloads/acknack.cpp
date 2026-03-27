#include "acknack.hpp"
#include "types/lorawan_response.hpp"

namespace lorawan::payload::acknack
{

    void encode( const lorawan::AckNack & ackNack,
                 std::span< uint8_t, kSize > buf ) noexcept
    {
        buf[ 0U ] = kVersion;
        buf[ 1U ] = kType;
        buf[ 2U ] = static_cast< uint8_t >( ackNack.response );
        buf[ 3U ] = static_cast< uint8_t >( ackNack.echoCmd  );
        buf[ 4U ] = static_cast< uint8_t >( ackNack.reason   );
    }

} /* namespace lorawan::payload::acknack */
