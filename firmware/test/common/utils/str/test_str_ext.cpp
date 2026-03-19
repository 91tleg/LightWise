#include <cstdint>
#include <cstring>

#include <gtest/gtest.h>

#include "utils/str/str_ext.h"

TEST( StrExtGetField, EdgeCases )
{
    const uint8_t buf[] { "RAW,DATA,,123" };
    size_t start { 0 };
    size_t len { 0 };

    /* Normal field */
    EXPECT_TRUE( str_ext_get_field( buf, 13, 0, 0, &start, &len ) );
    EXPECT_EQ( len, 3U );
    EXPECT_EQ( start, 0U );

    /* Empty field */
    EXPECT_TRUE( str_ext_get_field( buf, 13, 0, 2, &start, &len ) );
    EXPECT_EQ( len, 0U );
    EXPECT_EQ( start, 9U );

    /* Out of bounds index */
    EXPECT_FALSE( str_ext_get_field( buf, 13, 0, 4, &start, &len ) );

    /* Starting position offset (parse from middle) */
    EXPECT_TRUE( str_ext_get_field( buf, 13, 4, 0, &start, &len ) ); /* Should find "DATA" */
    EXPECT_EQ( len, 4U );
    EXPECT_EQ( start, 4U );
}


TEST( StrExtParseX100, PrecisionAndSigns )
{
    int32_t val { 0U };

    struct TestCase
    {
        const char * input;
        int32_t expected;
        bool success;
    };

    const TestCase cases[]
    {
        { .input = "1.23", .expected = 123, .success = true },
        { .input = "1.2", .expected = 120, .success = true },
        { .input = "-0.01", .expected = -1, .success = true },
        { .input = "5.", .expected = 500, .success = false },
        { .input = ".05", .expected = 5, .success = true },
        { .input = "-", .expected = 0, .success = false },
        { .input = "1.2345", .expected = 123, .success = true }
    };

    for( const auto & c : cases )
    {
        bool res { str_ext_parse_x100( reinterpret_cast< const uint8_t * >( c.input ),
                                       strlen( c.input ), &val ) };
        EXPECT_EQ( res, c.success ) << "Failed on input: " << c.input;
        if( c.success )
        {
            EXPECT_EQ( val, c.expected );
        }
    }
}

TEST( StrExtToUpperCase, BoundaryCheck )
{
    char str[] { "a1!zZ" };
    EXPECT_TRUE( str_ext_to_upper_case( str ) );
    EXPECT_STREQ( str, "A1!ZZ" );

    EXPECT_FALSE( str_ext_to_upper_case( nullptr ) );
}

TEST( StrExtHex, BufferSafety )
{
    const uint8_t data[] { 0x01U, 0x23U, 0x45U, 0xABU, 0xFFU };
    char out[11] {};

    EXPECT_TRUE( str_ext_uint8_array_to_hex_string( data, 5, out, 11 ) );
    EXPECT_STREQ( out, "012345ABFF" );

    /* Buffer too small for null terminator */
    EXPECT_FALSE( str_ext_uint8_array_to_hex_string( data, 5, out, 10 ) );

    /* Null safety */
    EXPECT_FALSE( str_ext_uint8_array_to_hex_string( nullptr, 5, out, 11 ) );
}

TEST( StrExtNumeric, LibcWrappers )
{
    long l_val { 0L };
    unsigned long ul_val { 0UL };

    const char * s_val { "-2147483648" };
    EXPECT_TRUE( str_ext_strtol( s_val, strlen( s_val ), &l_val ) );
    EXPECT_EQ( l_val, -2147483648L );

    const char * u_val { "4294967295" };
    EXPECT_TRUE( str_ext_strtoul( u_val, strlen( u_val ), &ul_val ) );
    EXPECT_EQ( ul_val, 4294967295UL );

    const char * too_long { "123456789012345678901234567890123" };
    EXPECT_FALSE( str_ext_strtol( too_long, strlen( too_long ), &l_val ) );

    const char * garbage { "123A" };
    EXPECT_FALSE( str_ext_strtol( garbage, 4, &l_val ) );
}

TEST( StrExtStrnlen, NullAndLimit )
{
    const char * text { "Hello" };

    EXPECT_EQ( str_ext_strnlen( text, 10 ), 5U );
    EXPECT_EQ( str_ext_strnlen( text, 3 ), 3U );
    EXPECT_EQ( str_ext_strnlen( nullptr, 10 ), 0U );
}

TEST( StrExtFindChar, RangeCheck )
{
    const uint8_t buf[] { 0xAAU, 0xBBU, 0xCCU, 0xAAU };

    EXPECT_EQ( str_ext_buf_find_char( buf, 4, 0xAAU ), 0 );
    EXPECT_EQ( str_ext_buf_find_char( buf, 4, 0xCCU ), 2 );
    EXPECT_EQ( str_ext_buf_find_char( buf, 4, 0xDDU ), -1 );
}
