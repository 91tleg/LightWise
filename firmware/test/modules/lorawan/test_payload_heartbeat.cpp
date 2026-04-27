#include <gtest/gtest.h>
#include <cstdint>
#include <array>
#include <span>

#include "modules/lorawan/payloads/heartbeat.hpp"
#include "types/lorawan_response.hpp"

using namespace lorawan::payload::heartbeat;

class HeartbeatEncodeTest : public ::testing::Test
{
protected:
    std::array< uint8_t, kSize > buf {};

    void SetUp() override
    {
        buf.fill( 0xFFU );
    }
};

TEST_F( HeartbeatEncodeTest, WritesVersionAtByte0 )
{
    encode( std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 0U ], kVersion );
}

TEST_F( HeartbeatEncodeTest, WritesTypeAtByte1 )
{
    encode( std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 1U ], kType );
}

TEST_F( HeartbeatEncodeTest, VersionIsOne )
{
    encode( std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 0U ], 0x01U );
}

TEST_F( HeartbeatEncodeTest, TypeIsZero )
{
    encode( std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 1U ], 0x00U );
}

TEST_F( HeartbeatEncodeTest, AllBytesWritten )
{
    static_assert( kSize == 2U, "Update if kSize changes" );
    encode( std::span< uint8_t, kSize >{ buf } );
    for( std::size_t i { 0U }; i < kSize; ++i )
    {
        EXPECT_NE( buf[ i ], 0xFFU ) << "Byte " << i << " was not written";
    }
}

TEST_F( HeartbeatEncodeTest, EncodingTwiceProducesSameResult )
{
    encode( std::span< uint8_t, kSize >{ buf } );
    const std::array< uint8_t, kSize > first { buf };

    encode( std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf, first );
}
