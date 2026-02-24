#include <gtest/gtest.h>
#include <cstdint>

#include "modules/lorawan/payloads/uplink_payload_v1.hpp"
#include "types/lorawan_data.hpp"

using namespace lorawan;

class UplinkPayloadV1Test : public ::testing::Test
{
protected:
    UplinkPayloadV1 payload{};
};

TEST_F( UplinkPayloadV1Test, SizeIsFixed )
{
    EXPECT_EQ( payload.size(), 7U );
}

TEST_F( UplinkPayloadV1Test, EncodeProducesExpectedBytes )
{
    UplinkData data{};
    data.lux_x10    = 1234U;
    data.tempC      = -5;
    data.humidity   = 55U;
    data.lightLevel = 80U;

    data.flags =
        static_cast<uint8_t>( UplinkData::StatusFlag::MotionPresent ) |
        static_cast<uint8_t>( UplinkData::StatusFlag::AlsPrimaryOk ) |
        static_cast<uint8_t>( UplinkData::StatusFlag::OverallOk );

    uint8_t out[ 7U ]{};
    payload.encode( data, out );

    const uint8_t expected[ 7U ] =
    {
        0x01,        /* version */
        0x04, 0xD2,  /* lux_x10 (big-endian) */
        0xFB,        /* tempC = -5 */
        55U,         /* humidity */
        0x83,        /* flags */
        80U          /* lightLevel */
    };

    for( size_t i = 0; i < 7U; ++i )
    {
        EXPECT_EQ( out[ i ], expected[ i ] )
            << "Mismatch at byte " << i;
    }
}

TEST_F( UplinkPayloadV1Test, EncodeHandlesNullBufferSafely )
{
    UplinkData data{};
    payload.encode( data, nullptr );  /* should not crash */
}
