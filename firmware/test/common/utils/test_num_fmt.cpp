#include <gtest/gtest.h>

#include "utils/num_fmt.h"

#include <cstring>

TEST( NumFmtHexEncode, NullPointers )
{
    char out[ 10 ];
    uint8_t data[ 1 ] = { 0xAA };

    EXPECT_FALSE( num_fmt_hex_encode( nullptr, 1, out, sizeof( out ) ) );
    EXPECT_FALSE( num_fmt_hex_encode( data, 1, nullptr, sizeof( out ) ) );
}

TEST( NumFmtHexEncode, BufferTooSmall )
{
    uint8_t data[ 2 ] = { 0x12, 0x34 };
    char out[ 4 ]; /* needs 5 */

    EXPECT_FALSE( num_fmt_hex_encode( data, 2, out, sizeof( out ) ) );
}

TEST( NumFmtHexEncode, SingleByte )
{
    uint8_t data[ 1 ] = { 0xAF };
    char out[ 3 ];

    EXPECT_TRUE( num_fmt_hex_encode( data, 1, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "AF" );
}

TEST( NumFmtHexEncode, MultipleBytes )
{
    uint8_t data[] = { 0x00, 0x01, 0xAB, 0xFF };
    char out[ 9 ];

    EXPECT_TRUE( num_fmt_hex_encode( data, sizeof( data ), out, sizeof( out ) ) );
    EXPECT_STREQ( out, "0001ABFF" );
}

TEST( NumFmtU32ToA, Zero )
{
    char out[ 2 ];

    EXPECT_TRUE( num_fmt_u32toa( 0, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "0" );
}

TEST( NumFmtU32ToA, TypicalValue )
{
    char out[ 12 ];

    EXPECT_TRUE( num_fmt_u32toa( 123456, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "123456" );
}

TEST( NumFmtU32ToA, MaxValue )
{
    char out[ 12 ];

    EXPECT_TRUE( num_fmt_u32toa( 4294967295UL, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "4294967295" );
}

TEST( NumFmtU32ToA, BufferTooSmall )
{
    char out[ 3 ];

    EXPECT_FALSE( num_fmt_u32toa( 1000, out, sizeof( out ) ) );
}

TEST( NumFmtU8ToA, Basic )
{
    char out[ 4 ];

    EXPECT_TRUE( num_fmt_u8toa( 255, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "255" );
}

TEST( NumFmtU32ToHex8, Zero )
{
    char out[ 9 ];

    EXPECT_TRUE( num_fmt_u32_to_hex8( 0x00000000, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "00000000" );
}

TEST( NumFmtU32ToHex8, TypicalValue )
{
    char out[ 9 ];

    EXPECT_TRUE( num_fmt_u32_to_hex8( 0x1234ABCD, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "1234ABCD" );
}

TEST( NumFmtU32ToHex8, MaxValue )
{
    char out[ 9 ];

    EXPECT_TRUE( num_fmt_u32_to_hex8( 0xFFFFFFFF, out, sizeof( out ) ) );
    EXPECT_STREQ( out, "FFFFFFFF" );
}

TEST( NumFmtU32ToHex8, BufferTooSmall )
{
    char out[ 8 ];

    EXPECT_FALSE( num_fmt_u32_to_hex8( 0x12345678, out, sizeof( out ) ) );
}

TEST( NumFmtAppendU16, Basic )
{
    char buf[ 16 ] = {};
    char *p = buf;

    p = num_fmt_append_u16( p, 12345 );
    *p = '\0';

    EXPECT_STREQ( buf, "12345" );
}

TEST( NumFmtAppendU16, Zero )
{
    char buf[ 16 ] = {};
    char *p = buf;

    p = num_fmt_append_u16( p, 0 );
    *p = '\0';

    EXPECT_STREQ( buf, "0" );
}

TEST( NumFmtAppendFixed1, WholeAndFraction )
{
    char buf[ 16 ] = {};
    char *p = buf;

    p = num_fmt_append_fixed1( p, 123 );
    *p = '\0';

    EXPECT_STREQ( buf, "12.3" );
}

TEST( NumFmtAppendFixed1, Zero )
{
    char buf[ 16 ] = {};
    char *p = buf;

    p = num_fmt_append_fixed1( p, 0 );
    *p = '\0';

    EXPECT_STREQ( buf, "0.0" );
}
