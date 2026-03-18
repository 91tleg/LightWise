#include <gtest/gtest.h>

#include "utils/ema.h"

TEST( EmaInit, ValidAlpha )
{
    EMAFilter f;

    EXPECT_TRUE( ema_init( &f, 0.5f ) );
    EXPECT_FLOAT_EQ( f.alpha, 0.5f );
    EXPECT_FLOAT_EQ( f.value, 0.0f );
    EXPECT_FALSE( f.isInitialized );
}

TEST( EmaInit, AlphaClampedLow )
{
    EMAFilter f;

    EXPECT_TRUE( ema_init( &f, -1.0f ) );
    EXPECT_FLOAT_EQ( f.alpha, 0.0f );
}

TEST( EmaInit, AlphaClampedHigh )
{
    EMAFilter f;

    EXPECT_TRUE( ema_init( &f, 2.0f ) );
    EXPECT_FLOAT_EQ( f.alpha, 1.0f );
}

TEST( EmaInit, NullFilter )
{
    EXPECT_FALSE( ema_init( nullptr, 0.5f ) );
}

TEST( EmaInit, AlphaZeroDefaults )
{
    EMAFilter f;

    /* Initialize with 0.0f alpha */
    EXPECT_TRUE( ema_init( &f, 0.0f ) );

    /* Check that the alpha was replaced with default, not left at 0 */
    EXPECT_FLOAT_EQ( f.alpha, 0.1f );

    EXPECT_FLOAT_EQ( f.value, 0.0f );
    EXPECT_FALSE( f.isInitialized );
}

TEST( EmaUpdate, FirstSampleInitializes )
{
    EMAFilter f;
    float out = 0.0f;

    ema_init( &f, 0.5f );

    EXPECT_TRUE( ema_update( &f, 10.0f, &out ) );
    EXPECT_TRUE( f.isInitialized );
    EXPECT_FLOAT_EQ( out, 10.0f );
    EXPECT_FLOAT_EQ( f.value, 10.0f );
}

TEST( EmaUpdate, SubsequentSamples )
{
    EMAFilter f;
    float out = 0.0f;

    ema_init( &f, 0.5f );

    ema_update( &f, 10.0f, &out );
    ema_update( &f, 14.0f, &out );

    /* value = 10 + 0.5 * (14 - 10) = 12 */
    EXPECT_FLOAT_EQ( out, 12.0f );
    EXPECT_FLOAT_EQ( f.value, 12.0f );
}

TEST( EmaUpdate, AlphaZeroDefaultsToDefault )
{
    EMAFilter f;
    float out = 0.0f;

    ema_init( &f, 0.0f );  /* replaced internally with EMA_ALPHA_DEFAULT */

    ema_update( &f, 10.0f, &out );
    EXPECT_FLOAT_EQ( out, 10.0f );

    ema_update( &f, 20.0f, &out );
    EXPECT_NE( out, 10.0f );       /* Should start moving toward 20 */
    EXPECT_NEAR( out, 11.0f, 1e-6f );
}

TEST( EmaUpdate, AlphaOneTracksInput )
{
    EMAFilter f;
    float out = 0.0f;

    ema_init( &f, 1.0f );

    ema_update( &f, 5.0f, &out );
    ema_update( &f, 20.0f, &out );

    EXPECT_FLOAT_EQ( out, 20.0f );
}

TEST( EmaUpdate, NullArgs )
{
    EMAFilter f;
    float out;

    ema_init( &f, 0.5f );

    EXPECT_FALSE( ema_update( nullptr, 1.0f, &out ) );
    EXPECT_FALSE( ema_update( &f, 1.0f, nullptr ) );
}

TEST( EmaReset, ClearsInitialization )
{
    EMAFilter f;
    float out = 0.0f;

    ema_init( &f, 0.5f );
    ema_update( &f, 10.0f, &out );

    EXPECT_TRUE( f.isInitialized );

    EXPECT_TRUE( ema_reset( &f ) );
    EXPECT_FALSE( f.isInitialized );

    /* Next update should reinitialize */
    ema_update( &f, 20.0f, &out );
    EXPECT_FLOAT_EQ( out, 20.0f );
}

TEST( EmaReset, NullFilter )
{
    EXPECT_FALSE( ema_reset( nullptr ) );
}
