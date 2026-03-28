#include <gtest/gtest.h>
#include <cstdint>
#include <array>

#include "modules/lorawan/payloads/v1.hpp"
#include "types/lorawan_uplink.hpp"

using namespace lorawan;
using namespace lorawan::payload::v1;

class PayloadV1EncodeTest : public ::testing::Test
{
protected:
    std::array< uint8_t, kSize > buf {};

    UplinkData baseData()
    {
        UplinkData d {};
        d.lux_x10 = 0;
        d.tempC = 0;
        d.humidity = 0;
        d.lightLevel = 0;
        d.motionDetected = false;
        d.thOk = false;
        d.lightOk = false;
        d.ambientHealth = SensorHealth::SYSTEM_OK;
        d.mmwaveHealth = SensorHealth::SYSTEM_OK;
        return d;
    }
};

TEST_F( PayloadV1EncodeTest, Encode_StaticProtocolHeaders )
{
    UplinkData data { baseData() };
    encode( data, buf );

    EXPECT_EQ( buf[ 0U ], kVersion );
    EXPECT_EQ( buf[ 1U ], kType );
}

TEST_F( PayloadV1EncodeTest, Encode_LuxEndianness )
{
    UplinkData data { baseData() };
    data.lux_x10 = 0x1234; /* 4660 in decimal */

    encode( data, buf );

    EXPECT_EQ( buf[ 2U ], 0x12U ); /* MSB */
    EXPECT_EQ( buf[ 3U ], 0x34U ); /* LSB */
}

TEST_F( PayloadV1EncodeTest, Encode_MinValues )
{
    UplinkData data { baseData() };

    encode( data, buf );

    const uint8_t expectedFlags1 {
        static_cast< uint8_t >(
            encodeHealth( data.ambientHealth ) |
            ( encodeHealth( data.mmwaveHealth ) << 3U )
        )
    };

    EXPECT_EQ( buf[ 2U ], 0x00U );
    EXPECT_EQ( buf[ 3U ], 0x00U );
    EXPECT_EQ( buf[ 4U ], 0U );
    EXPECT_EQ( buf[ 5U ], 0U );

    EXPECT_EQ( buf[ 6U ], expectedFlags1 );
    EXPECT_EQ( buf[ 7U ], 0x0U );
}

TEST_F( PayloadV1EncodeTest, Encode_MaxLux )
{
    UplinkData data { baseData() };
    data.lux_x10 = 65535U;

    encode( data, buf );

    EXPECT_EQ( buf[ 2U ], 0xFFU );
    EXPECT_EQ( buf[ 3U ], 0xFFU );
}

TEST_F( PayloadV1EncodeTest, Encode_NegativeTemperatureWraps )
{
    UplinkData data { baseData() };
    data.tempC = -1;

    encode( data, buf );

    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( -1 ) ); /* 255 */
}

TEST_F( PayloadV1EncodeTest, Encode_TemperatureLimits )
{
    UplinkData data { baseData() };
    
    data.tempC = 127;
    encode( data, buf );
    EXPECT_EQ( buf[ 4U ], 0x7FU );

    data.tempC = -128;
    encode( data, buf );
    EXPECT_EQ( buf[ 4U ], 0x80U ); 
}

TEST_F( PayloadV1EncodeTest, Encode_Flags1_AllBits )
{
    UplinkData data { baseData() };
    data.motionDetected = true;
    data.thOk = true;
    data.lightOk = true;
    data.ambientHealth = SensorHealth::SYSTEM_OK;
    data.mmwaveHealth  = SensorHealth::SYSTEM_OK;

    encode( data, buf );

    const uint8_t expected {
        static_cast< uint8_t >(
            ( encodeHealth( data.ambientHealth )      ) |
            ( encodeHealth( data.mmwaveHealth ) << 3U ) |
            0x40U | /* motionPresent */
            0x80U    /* overallOk   */
        )
    }; 

    EXPECT_EQ( buf[ 6U ], expected );
}

TEST_F( PayloadV1EncodeTest, Encode_OverallOk_True )
{
    UplinkData data { baseData() };
    data.thOk    = true;
    data.lightOk = true;
    data.ambientHealth = SensorHealth::SYSTEM_OK;
    data.mmwaveHealth  = SensorHealth::SYSTEM_OK;

    encode( data, buf );

    EXPECT_TRUE( buf[ 6U ] & 0x80U );
    EXPECT_TRUE( buf[ 7U ] & 0x02U );
}

TEST_F( PayloadV1EncodeTest, Encode_OverallOk_False_WhenAnyFails )
{
    UplinkData data { baseData() };
    data.thOk    = false;
    data.lightOk = true;
    data.ambientHealth = SensorHealth::SYSTEM_OK;
    data.mmwaveHealth  = SensorHealth::SYSTEM_OK;

    encode( data, buf );

    EXPECT_FALSE( buf[ 6U ] & 0x80U );
}

TEST_F( PayloadV1EncodeTest, Encode_MaxHumidity )
{
    UplinkData data { baseData() };
    data.humidity = 255;

    encode( data, buf );

    EXPECT_EQ( buf[ 5U ], 255U );
}

TEST_F( PayloadV1EncodeTest, Encode_LightLevel )
{
    UplinkData data { baseData() };
    data.lightLevel = 100U;

    encode( data, buf );

    EXPECT_EQ( buf[ 8U ], 100U );
}

TEST_F( PayloadV1EncodeTest, Encode_All )
{
    UplinkData data {};
    data.lux_x10 = 0x1234U;
    data.tempC = 25;
    data.humidity = 50U;
    data.lightLevel = 75U;
    data.ambientHealth = SensorHealth::SYSTEM_OK; /* 100 */
    data.mmwaveHealth = SensorHealth::DEGRADED;   /* 011 */
    data.motionDetected = true;
    data.thOk = true;                             /* 1 (Flags2 bit 0) */
    data.lightOk = true;                          /* 1 (Flags2 bit 1) */

    encode( data, buf );

    std::array< uint8_t, 9U > expected {
        0x01U, 0x01U,
        0x12U, 0x34U,
        0x19U,
        0x32U,
        0x5CU,
        0x03U,
        0x4BU };

    for( size_t i { 0U }; i < kSize; ++i )
    {
        EXPECT_EQ( buf[ i ], expected[ i ] ) << "Mismatch at index " << i;
    }
}

TEST( EncodeHealthTest, AllMappings )
{
    EXPECT_EQ( encodeHealth( SensorHealth::SYSTEM_OK ),      0b100U );
    EXPECT_EQ( encodeHealth( SensorHealth::DEGRADED ),       0b011U );
    EXPECT_EQ( encodeHealth( SensorHealth::SECONDARY_FAIL ), 0b010U );
    EXPECT_EQ( encodeHealth( SensorHealth::PRIMARY_FAIL ),   0b001U );
    EXPECT_EQ( encodeHealth( SensorHealth::TOTAL_FAILURE ),  0b000U );
}

TEST( EncodeHealthTest, Ordering )
{
    EXPECT_GT( encodeHealth( SensorHealth::SYSTEM_OK ),
               encodeHealth( SensorHealth::DEGRADED ) );

    EXPECT_GT( encodeHealth( SensorHealth::DEGRADED ),
               encodeHealth( SensorHealth::PRIMARY_FAIL ) );
}
