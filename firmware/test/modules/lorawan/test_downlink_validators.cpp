#include <gtest/gtest.h>

#include "modules/lorawan/downlink_validators.hpp"

using namespace lorawan;
using namespace lorawan::validators;

static DownlinkPayload makePayload( DownlinkCmd cmd,
                                    std::initializer_list< uint8_t > params )
{
    DownlinkPayload pl {};
    pl.cmd = cmd;
    pl.version = 1U;
    pl.paramLen = static_cast< uint8_t >( params.size() );

    uint8_t i { 0U };
    for( const uint8_t b : params )
    {
        pl.params[ i++ ] = b;
    }
    return pl;
}

class SetLevelsTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( std::initializer_list< uint8_t > bytes )
    {
        return makePayload( DownlinkCmd::SetLevels, bytes );
    }
};

TEST_F( SetLevelsTest, RejectsEmptyParams )
{
    const auto r { validateSetLevels( pl( {} ) ) };
    EXPECT_FALSE( r.valid );
    EXPECT_EQ( r.reason, ReasonCode::InvalidParam );
}

TEST_F( SetLevelsTest, RejectsOneParam )
{
    const auto r { validateSetLevels( pl( { 50U } ) ) };
    EXPECT_FALSE( r.valid );
    EXPECT_EQ( r.reason, ReasonCode::InvalidParam );
}

TEST_F( SetLevelsTest, RejectsMaxZero )
{
    const auto r { validateSetLevels( pl( { 0U, 0U } ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( SetLevelsTest, RejectsMaxAbove100 )
{
    const auto r { validateSetLevels( pl( { 101U, 50U } ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( SetLevelsTest, RejectsDimAbove100 )
{
    const auto r { validateSetLevels( pl( { 100U, 101U } ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( SetLevelsTest, RejectsDimExceedsMax )
{
    const auto r { validateSetLevels( pl( { 50U, 80U } ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( SetLevelsTest, AcceptsDimEqualToMax )
{
    const auto r { validateSetLevels( pl( { 70U, 70U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.max, 70U );
    EXPECT_EQ( r.dim, 70U );
}

TEST_F( SetLevelsTest, AcceptsDimZero )
{
    const auto r { validateSetLevels( pl( { 80U, 0U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.dim, 0U );
}

TEST_F( SetLevelsTest, AcceptsMax100Dim100 )
{
    const auto r { validateSetLevels( pl( { 100U, 100U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.max, 100U );
    EXPECT_EQ( r.dim, 100U );
}

TEST_F( SetLevelsTest, AcceptsMax1Dim0 )
{
    const auto r { validateSetLevels( pl( { 1U, 0U } ) ) };
    EXPECT_TRUE( r.valid );
}

TEST_F( SetLevelsTest, IgnoresExtraParams )
{
    /* paramLen > 2 is fine — extras are ignored */
    const auto r { validateSetLevels( pl( { 60U, 30U, 0xFFU } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.max, 60U );
    EXPECT_EQ( r.dim, 30U );
}

class MotionTimeoutTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( uint16_t timeout )
    {
        return makePayload( DownlinkCmd::SetMotionTimeout,
                            { static_cast< uint8_t >( timeout >> 8U ),
                              static_cast< uint8_t >( timeout & 0xFFU ) } );
    }
};

TEST_F( MotionTimeoutTest, RejectsEmptyParams )
{
    const auto r { validateMotionTimeout( makePayload( DownlinkCmd::SetMotionTimeout, {} ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( MotionTimeoutTest, RejectsOneParam )
{
    const auto r { validateMotionTimeout( makePayload( DownlinkCmd::SetMotionTimeout, { 0U } ) ) };
    EXPECT_FALSE( r.valid );
}

TEST_F( MotionTimeoutTest, RejectsBelowMinimum )
{
    EXPECT_FALSE( validateMotionTimeout( pl( 14U ) ).valid );
    EXPECT_FALSE( validateMotionTimeout( pl( 0U  ) ).valid );
}

TEST_F( MotionTimeoutTest, RejectsAboveMaximum )
{
    EXPECT_FALSE( validateMotionTimeout( pl( 3601U ) ).valid );
    EXPECT_FALSE( validateMotionTimeout( pl( 0xFFFFU ) ).valid );
}

TEST_F( MotionTimeoutTest, AcceptsLowerBoundary )
{
    const auto r { validateMotionTimeout( pl( 15U ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.timeoutS, 15U );
}

TEST_F( MotionTimeoutTest, AcceptsUpperBoundary )
{
    const auto r { validateMotionTimeout( pl( 3600U ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.timeoutS, 3600U );
}

TEST_F( MotionTimeoutTest, DecodesHighByteCorrectly )
{
    /* 300 = 0x01 0x2C */
    const auto r { validateMotionTimeout( pl( 300U ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.timeoutS, 300U );
}

class OverrideOnTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( std::initializer_list< uint8_t > bytes )
    {
        return makePayload( DownlinkCmd::OverrideOn, bytes );
    }
};

TEST_F( OverrideOnTest, RejectsEmptyParams )
{
    EXPECT_FALSE( validateOverrideOn( pl( {} ) ).valid );
}

TEST_F( OverrideOnTest, RejectsLevelZero )
{
    EXPECT_FALSE( validateOverrideOn( pl( { 0U } ) ).valid );
}

TEST_F( OverrideOnTest, RejectsAbove100 )
{
    EXPECT_FALSE( validateOverrideOn( pl( { 101U } ) ).valid );
}

TEST_F( OverrideOnTest, AcceptsLowerBoundary )
{
    const auto r { validateOverrideOn( pl( { 1U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.level, 1U );
}

TEST_F( OverrideOnTest, AcceptsUpperBoundary )
{
    const auto r { validateOverrideOn( pl( { 100U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.level, 100U );
}

class MotionSensitivityTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( std::initializer_list< uint8_t > bytes )
    {
        return makePayload( DownlinkCmd::SetMotionSensitivity, bytes );
    }
};

TEST_F( MotionSensitivityTest, RejectsEmptyParams )
{
    EXPECT_FALSE( validateMotionSensitivity( pl( {} ) ).valid );
}

TEST_F( MotionSensitivityTest, RejectsZero )
{
    EXPECT_FALSE( validateMotionSensitivity( pl( { 0U } ) ).valid );
}

TEST_F( MotionSensitivityTest, RejectsAbove10 )
{
    EXPECT_FALSE( validateMotionSensitivity( pl( { 11U } ) ).valid );
}

TEST_F( MotionSensitivityTest, AcceptsLowerBoundary )
{
    const auto r { validateMotionSensitivity( pl( { 1U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.sensitivity, 1U );
}

TEST_F( MotionSensitivityTest, AcceptsUpperBoundary )
{
    const auto r { validateMotionSensitivity( pl( { 10U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.sensitivity, 10U );
}

class HeartbeatIntervalTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( std::initializer_list< uint8_t > bytes )
    {
        return makePayload( DownlinkCmd::SetHeartbeatInterval, bytes );
    }
};

TEST_F( HeartbeatIntervalTest, RejectsEmptyParams )
{
    EXPECT_FALSE( validateHeartbeatInterval( pl( {} ) ).valid );
}

TEST_F( HeartbeatIntervalTest, RejectsZeroInterval )
{
    EXPECT_FALSE( validateHeartbeatInterval( pl( { 0U } ) ).valid );
}

TEST_F( HeartbeatIntervalTest, AcceptsOne )
{
    const auto r { validateHeartbeatInterval( pl( { 1U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.intervalMin, 1U );
}

TEST_F( HeartbeatIntervalTest, AcceptsMaxByte )
{
    const auto r { validateHeartbeatInterval( pl( { 255U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.intervalMin, 255U );
}

class TempDimTest : public ::testing::Test
{
protected:
    DownlinkPayload pl( std::initializer_list< uint8_t > bytes )
    {
        return makePayload( DownlinkCmd::SetTempDim, bytes );
    }
};

TEST_F( TempDimTest, RejectsEmptyParams )
{
    EXPECT_FALSE( validateTempDim( pl( {} ) ).valid );
}

TEST_F( TempDimTest, RejectsOneParam )
{
    EXPECT_FALSE( validateTempDim( pl( { 50U } ) ).valid );
}

TEST_F( TempDimTest, RejectsLevelAbove100 )
{
    EXPECT_FALSE( validateTempDim( pl( { 101U, 1U } ) ).valid );
}

TEST_F( TempDimTest, RejectsHoursZero )
{
    EXPECT_FALSE( validateTempDim( pl( { 50U, 0U } ) ).valid );
}

TEST_F( TempDimTest, RejectsHoursAbove24 )
{
    EXPECT_FALSE( validateTempDim( pl( { 50U, 25U } ) ).valid );
}

TEST_F( TempDimTest, AcceptsLevelZero )
{
    const auto r { validateTempDim( pl( { 0U, 4U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.level, 0U );
    EXPECT_EQ( r.hours, 4U );
}

TEST_F( TempDimTest, AcceptsLevelBoundary )
{
    const auto r { validateTempDim( pl( { 100U, 1U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.level, 100U );
}

TEST_F( TempDimTest, AcceptsHoursUpperBoundary )
{
    const auto r { validateTempDim( pl( { 50U, 24U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.hours, 24U );
}

TEST_F( TempDimTest, AcceptsHoursLowerBoundary )
{
    const auto r { validateTempDim( pl( { 50U, 1U } ) ) };
    EXPECT_TRUE( r.valid );
    EXPECT_EQ( r.hours, 1U );
}
