#include <gtest/gtest.h>

#include "hal/alspt19.h"
#include "lib/ambient/alspt19.hpp"

static uint16_t g_mockAdcValue;

extern "C"
{
    bool alspt19_hal_read_raw( const AlsPt19Hw * sensor, uint16_t * out )
    {
        ( void ) sensor;
        if( out == nullptr )
        {
            return false;
        }
        *out = g_mockAdcValue;
        return true;
    }
}

class AlsPt19Test : public ::testing::Test
{
  protected:
    const AlsPt19Hw hw{};

    void SetUp() override
    {
        g_mockAdcValue = 0U;
    }
};

TEST_F( AlsPt19Test, InitSuccess )
{
    ambient::Alspt19 dev( &hw );
    EXPECT_TRUE( dev.init() );
}

TEST_F( AlsPt19Test, InitFailsWithNullHw )
{
    ambient::Alspt19 dev( nullptr );
    EXPECT_FALSE( dev.init() );
}

TEST_F( AlsPt19Test, LuxCalculationZero )
{
    float lux = -1.0f;
    ambient::Alspt19 dev( &hw );

    ASSERT_TRUE( dev.init() );

    g_mockAdcValue = 0U;
    EXPECT_TRUE( dev.read( lux ) );
    EXPECT_FLOAT_EQ( lux, 0.0f );
}

TEST_F( AlsPt19Test, LuxCalculationMidScale )
{
    float lux = 0.0f;
    ambient::Alspt19 dev( &hw );

    ASSERT_TRUE( dev.init() );

    g_mockAdcValue = 2048U; /* Half-scale */
    EXPECT_TRUE( dev.read( lux ) );

    float expected = ( 2048.0f / 4095.0f ) * 1000.0f;
    EXPECT_NEAR( lux, expected, 0.01f );
}

TEST_F( AlsPt19Test, LuxCalculationFullScale )
{
    float lux = 0.0f;
    ambient::Alspt19 dev( &hw );

    ASSERT_TRUE( dev.init() );

    g_mockAdcValue = 4095U; /* Full-scale */
    EXPECT_TRUE( dev.read( lux ) );
    EXPECT_FLOAT_EQ( lux, 1000.0f );
}

TEST_F( AlsPt19Test, ReadFailsIfNotInitialized )
{
    float lux = 0.0f;
    ambient::Alspt19 dev( &hw );

    /* Read before calling .init() */
    EXPECT_FALSE( dev.read( lux ) );
}