#include <array>
#include <cstdint>
#include <cstring>

#include <gtest/gtest.h>

#include "utils/security/secure_zero.hpp"

using namespace security;

/* secureZero( std::span< std::byte > ) */

TEST( SecureZeroSpan, ZeroesAllBytes )
{
    std::array< std::byte, 16U > buf {};
    buf.fill( std::byte{ 0xFFU } );

    secureZero( std::span< std::byte >{ buf.data(), buf.size() } );

    for( const std::byte & b : buf )
    {
        EXPECT_EQ( b, std::byte{ 0U } );
    }
}

TEST( SecureZeroSpan, EmptySpan_DoesNotCrash )
{
    secureZero( std::span< std::byte > {} );
}

TEST( SecureZeroSpan, SingleByte_Zeroed )
{
    std::byte b { std::byte { 0xABU } };
    secureZero( std::span< std::byte > { &b, 1U } );
    EXPECT_EQ( b, std::byte { 0U } );
}

/* secureZero( T & obj ) — template overload  */

TEST( SecureZeroTemplate, ZeroesStruct )
{
    struct KeyMaterial
    {
        uint8_t key[ 16U ] { 0xAAU, 0xBBU, 0xCCU, 0xDDU,
                             0xAAU, 0xBBU, 0xCCU, 0xDDU,
                             0xAAU, 0xBBU, 0xCCU, 0xDDU,
                             0xAAU, 0xBBU, 0xCCU, 0xDDU };
    };

    KeyMaterial km {};
    secureZero( km );

    for( const uint8_t & b : km.key )
    {
        EXPECT_EQ( b, 0U );
    }
}

TEST( SecureZeroTemplate, ZeroesArray )
{
    std::array< char, 32U > buf {};
    buf.fill( 'A' );

    secureZero( buf );

    for( const char & c : buf )
    {
        EXPECT_EQ( c, '\0' );
    }
}

TEST( SecureZeroTemplate, ZeroesPrimitive )
{
    uint32_t secret { 0xDEADBEEFU };
    secureZero( secret );
    EXPECT_EQ( secret, 0U );
}

TEST( SecureZeroTemplate, ZeroesNestedStruct )
{
    struct Inner
    {
        uint8_t a { 0xAAU };
        uint8_t b { 0xBBU };
    };

    struct Outer
    {
        Inner  inner {};
        uint32_t tag { 0xDEADBEEFU };
    };

    Outer obj {};
    secureZero( obj );

    EXPECT_EQ( obj.inner.a, 0U );
    EXPECT_EQ( obj.inner.b, 0U );
    EXPECT_EQ( obj.tag,     0U );
}

TEST( SecureZeroTemplate, DoesNotAffectAdjacentMemory )
{
    struct Guarded
    {
        uint8_t  guard1 { 0xFFU };
        uint32_t secret { 0xDEADBEEFU };
        uint8_t  guard2 { 0xFFU };
    };

    Guarded g {};
    secureZero( g.secret );

    EXPECT_EQ( g.secret, 0U    );
    EXPECT_EQ( g.guard1, 0xFFU ); /* adjacent memory untouched */
    EXPECT_EQ( g.guard2, 0xFFU ); /* adjacent memory untouched */
}
