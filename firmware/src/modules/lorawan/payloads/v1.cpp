#include "v1.hpp"
#include "types/lorawan_uplink.hpp"

namespace lorawan::payload::v1
{

    namespace
    {

        constexpr uint8_t kFlags1MotionPresent { static_cast< uint8_t >( 1U << 6U ) };
        constexpr uint8_t kFlags1OverallOk     { static_cast< uint8_t >( 1U << 7U ) };
        constexpr uint8_t kFlags2ThOk          { static_cast< uint8_t >( 1U << 0U ) };
        constexpr uint8_t kFlags2LightOk       { static_cast< uint8_t >( 1U << 1U ) };

    } /* anonymous namespace */

    void encode( const lorawan::UplinkData & data,
                 std::span< uint8_t, kSize > buf ) noexcept
    {
        const uint16_t lux { static_cast< uint16_t >( data.lux_x10 ) };

        const uint8_t ambientBits { encodeHealth( data.ambientHealth ) };
        const uint8_t mmwaveBits  { encodeHealth( data.mmwaveHealth  ) };

        const bool overallOk {
            ( data.ambientHealth == SensorHealth::SYSTEM_OK ) &&
            ( data.mmwaveHealth  == SensorHealth::SYSTEM_OK ) &&
            data.thOk                                         &&
            data.lightOk
        };

        const uint8_t flags1 {
            static_cast< uint8_t >(
                ( ambientBits                                            ) |
                ( static_cast< uint8_t >( ( mmwaveBits & 0x07U ) << 3U ) ) |
                ( data.motionDetected ? kFlags1MotionPresent : 0U        ) |
                ( overallOk           ? kFlags1OverallOk     : 0U        )
            )
        };

        const uint8_t flags2 {
            static_cast< uint8_t >(
                ( data.thOk    ? kFlags2ThOk    : 0U ) |
                ( data.lightOk ? kFlags2LightOk : 0U )
            )
        };

        buf[ 0U ] = kVersion;
        buf[ 1U ] = kType;
        buf[ 2U ] = static_cast< uint8_t >( lux >> 8U );   /* lux MSB */
        buf[ 3U ] = static_cast< uint8_t >( lux & 0xFFU ); /* lux LSB */
        buf[ 4U ] = static_cast< uint8_t >( data.tempC );
        buf[ 5U ] = data.humidity;
        buf[ 6U ] = flags1;
        buf[ 7U ] = flags2;
        buf[ 8U ] = data.lightLevel;
    }

} /* namespace lorawan::payload::v1 */
