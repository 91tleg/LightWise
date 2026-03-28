#include <cstdint>

#include <gtest/gtest.h>

#include "utils/math/ema.hpp"

using filter::EMA;

TEST( EmaCtor, ValidAlpha )
{
    EMA< float > f( 0.5f );

    EXPECT_FLOAT_EQ( f.alpha(), 0.5f );
}

TEST( EmaCtor, AlphaClampedLow )
{
    EMA< float > f( -1.0f );

    EXPECT_FLOAT_EQ( f.alpha(), 0.0f );
}

TEST( EmaCtor, AlphaClampedHigh )
{
    EMA< float > f( 2.0f );

    EXPECT_FLOAT_EQ( f.alpha(), 1.0f );
}

TEST( EmaCtor, AlphaZeroDefaults )
{
    EMA< float > f( 0.0f );

    EXPECT_FLOAT_EQ( f.alpha(), filter::kAlphaDefault );
}

TEST( EmaUpdate, FirstSampleInitializes )
{
    EMA< float > f( 0.5f );
    float out { 0.0f };

    EXPECT_TRUE( f.update( 10.0f, out ) );
    EXPECT_FLOAT_EQ( out, 10.0f );
}

TEST( EmaUpdate, SubsequentSamples )
{
    EMA< float > f( 0.5f );
    float out { 0.0f };

    static_cast< void >( f.update( 10.0f, out ) );
    static_cast< void >( f.update( 14.0f, out ) );

    /* 10 + 0.5 * (14 - 10) = 12 */
    EXPECT_FLOAT_EQ( out, 12.0f );
}

TEST( EmaUpdate, AlphaZeroDefaultsToDefault )
{
    EMA< float > f( 0.0f );  /* Uses default alpha */
    float out { 0.0f };

    static_cast< void >( f.update( 10.0f, out ) );
    EXPECT_FLOAT_EQ( out, 10.0f );

    static_cast< void >( f.update( 20.0f, out ) );

    EXPECT_NE( out, 10.0f );
    EXPECT_NEAR( out, 11.0f, 1e-6f ); /* 10 + 0.1 * (20-10) */
}

TEST( EmaUpdate, AlphaOneTracksInput )
{
    EMA< float > f( 1.0f );
    float out { 0.0f };

    static_cast< void >( f.update( 5.0f, out ) );
    static_cast< void >( f.update( 20.0f, out ) );

    EXPECT_FLOAT_EQ( out, 20.0f );
}

TEST( EmaUpdate, ConvergesToConstant )
{
    EMA< float > f( 0.2f );
    float out { 0.0f };

    for( int i { 0 }; i < 50; ++i )
    {
        static_cast< void >( f.update( 100.0f, out ) );
    }

    EXPECT_NEAR( out, 100.0f, 1e-3f );
}

TEST( EmaUpdate, MonotonicIncrease )
{
    EMA< float > f( 0.2f );
    float out { 0.0f };

    static_cast< void >( f.update( 0.0f, out ) );

    float prev { out };

    for( int i { 0 }; i < 10; ++i )
    {
        static_cast< void >( f.update( 100.0f, out ) );
        EXPECT_GE( out, prev );  /* Should not decrease */
        prev = out;
    }
}

TEST( EmaUpdate, VerySmallAlpha )
{
    EMA< float > f( 1e-6f );
    float out { 0.0f };

    static_cast< void >( f.update( 10.0f, out ) );
    static_cast< void >( f.update( 20.0f, out ) );

    /* Should barely move */
    EXPECT_NEAR( out, 10.0f, 1e-4f );
}

TEST( EmaUpdate, AlternatingInputStability )
{
    EMA< float > f( 0.5f );
    float out { 0.0f };

    static_cast< void >( f.update( 0.0f, out ) );

    for( int i { 0 }; i < 20; ++i )
    {
        static_cast< void >( f.update( ( i % 2 == 0 ) ? 100.0f : 0.0f, out ) );
    }

    /* Should stay bounded and stable */
    EXPECT_GT( out, 0.0f );
    EXPECT_LT( out, 100.0f );
}

TEST( EmaReset, ClearsInitialization )
{
    EMA< float > f( 0.5f );
    float out { 0.0f };

    static_cast< void >( f.update( 10.0f, out ) );

    EXPECT_TRUE( f.reset() );

    /* Next update should behave like first sample */
    static_cast< void >( f.update( 20.0f, out ) );
    EXPECT_FLOAT_EQ( out, 20.0f );
}

TEST( EmaReset, Idempotent )
{
    EMA< float > f( 0.5f );

    EXPECT_TRUE( f.reset() );
    EXPECT_TRUE( f.reset() );  /* should still succeed */
}

TEST( EmaReconfigure, ChangesAlpha )
{
    EMA< float > f( 0.5f );

    EXPECT_TRUE( f.reconfigure( 0.2f ) );
    EXPECT_FLOAT_EQ( f.alpha(), 0.2f );
}

TEST( EmaReconfigure, ZeroUsesDefault )
{
    EMA< float > f( 0.5f );

    static_cast< void >( f.reconfigure( 0.0f ) );

    EXPECT_FLOAT_EQ( f.alpha(), filter::kAlphaDefault );
}

TEST( EmaReconfigure, DoesNotResetState )
{
    EMA< float > f( 0.5f );
    float out { 0.0f };

    static_cast< void >( f.update( 10.0f, out ) );
    static_cast< void >( f.update( 20.0f, out ) );

    EXPECT_TRUE( f.reconfigure( 1.0f ) );

    static_cast< void >( f.update( 30.0f, out ) );

    /* Should use new alpha but old state */
    EXPECT_FLOAT_EQ( out, 30.0f );
}

TEST( EmaCopy, PreservesState )
{
    EMA< float > f1( 0.5f );
    float out { 0.0f };

    static_cast< void >( f1.update( 10.0f, out ) );
    static_cast< void >( f1.update( 20.0f, out ) );

    EMA<float> f2 = f1;

    static_cast< void >( f2.update( 30.0f, out ) );

    /* Should behave consistently from copied state */
    EXPECT_GT( out, 20.0f );
}

TEST( EmaUint8, WorksWithU8 )
{
    EMA< uint8_t > f( 0.5f );
    uint8_t out { 0U };

    static_cast< void >( f.update( 10, out ) );
    EXPECT_EQ( out, 10 );

    static_cast< void >( f.update( 20, out ) );
    EXPECT_EQ( out, 15 ); /* 10 + 0.5 * ( 20-10 ) */
}

TEST( EmaUint8, RoundingBehavior )
{
    EMA< uint8_t > f( 0.5f );
    uint8_t out { 0U };

    static_cast< void >( f.update( 0, out ) );
    static_cast< void >( f.update( 1, out ) );

    /* 0 + 0.5 * ( 1-0 ) = 0.5 - truncated to 0 */
    EXPECT_EQ( out, 0 );
}

TEST( EmaUint8, HighValues )
{
    EMA< uint8_t > f( 0.5f );
    uint8_t out { 0U };

    static_cast< void >( f.update( 255, out ) );
    EXPECT_EQ( out, 255 );

    static_cast< void >( f.update( 255, out ) );
    EXPECT_EQ( out, 255 );
}
