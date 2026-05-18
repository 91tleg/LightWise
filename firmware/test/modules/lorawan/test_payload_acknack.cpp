#include <gtest/gtest.h>
#include <array>
#include <cstdint>
#include <span>

#include "modules/lorawan/payloads/acknack.hpp"
#include "types/lorawan_response.hpp"

using namespace lorawan::payload::acknack;

class AckNackEncodeTest : public ::testing::Test
{
protected:
    std::array< uint8_t, kSize > buf {};

    void SetUp() override
    {
        buf.fill( 0xFFU );
    }
};

TEST_F( AckNackEncodeTest, WritesVersionAtByte0 )
{
    lorawan::AckNack ackNack {};
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 0U ], kVersion );
}

TEST_F( AckNackEncodeTest, WritesTypeAtByte1 )
{
    lorawan::AckNack ackNack {};
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 1U ], kType );
}

TEST_F( AckNackEncodeTest, EncodesAckResponseCode )
{
    lorawan::AckNack ackNack {};
    ackNack.response = lorawan::ResponseCode::Ack;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 2U ], static_cast< uint8_t >( lorawan::ResponseCode::Ack ) );
}

TEST_F( AckNackEncodeTest, EncodesNackResponseCode )
{
    lorawan::AckNack ackNack {};
    ackNack.response = lorawan::ResponseCode::Nack;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 2U ], static_cast< uint8_t >( lorawan::ResponseCode::Nack ) );
}

TEST_F( AckNackEncodeTest, EncodesEchoCmdResumeAuto )
{
    lorawan::AckNack ackNack {};
    ackNack.echoCmd = lorawan::DownlinkCmd::ResumeAuto;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 3U ], static_cast< uint8_t >( lorawan::DownlinkCmd::ResumeAuto ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonOk )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::Ok;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::Ok ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonInvalidVersion )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::InvalidVersion;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::InvalidVersion ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonInvalidCmd )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::InvalidCmd;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::InvalidCmd ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonInvalidParam )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::InvalidParam;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::InvalidParam ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonNvsError )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::NvsError;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::NvsError ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonFsmError )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::FsmError;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::FsmError ) );
}

TEST_F( AckNackEncodeTest, EncodesReasonPayloadTooShort )
{
    lorawan::AckNack ackNack {};
    ackNack.reason = lorawan::ReasonCode::PayloadTooShort;
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::PayloadTooShort ) );
}

TEST_F( AckNackEncodeTest, DefaultConstructedValuesAreCorrect )
{
    lorawan::AckNack ackNack {}; /* Nack, ResumeAuto, Ok */
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );

    EXPECT_EQ( buf[ 0U ], kVersion );
    EXPECT_EQ( buf[ 1U ], kType );
    EXPECT_EQ( buf[ 2U ], static_cast< uint8_t >( lorawan::ResponseCode::Nack ) );
    EXPECT_EQ( buf[ 3U ], static_cast< uint8_t >( lorawan::DownlinkCmd::ResumeAuto ) );
    EXPECT_EQ( buf[ 4U ], static_cast< uint8_t >( lorawan::ReasonCode::Ok ) );
}

TEST_F( AckNackEncodeTest, DoesNotWriteBeyondBufferBounds )
{
    static_assert( kSize == 5U, "Update if kSize changes" );
    lorawan::AckNack ackNack {};
    encode( ackNack, std::span< uint8_t, kSize >{ buf } );
    /* All 5 bytes written */
    for( std::size_t i { 0U }; i < kSize; ++i )
    {
        EXPECT_NE( buf[ i ], 0xFFU ) << "Byte " << i << " was not written";
    }
}
