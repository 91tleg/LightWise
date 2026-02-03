#include <gtest/gtest.h>

#include "hal/alspt19.h"
#include "lib/alspt19.h"

static uint16_t g_mockAdcValue;

bool alspt19_hal_read_raw( const AlsPt19Hw * sensor,
                           uint16_t * out )
{
    ( void ) sensor;
    *out = g_mockAdcValue;
    return true;
}

class AlsPt19Test : public ::testing::Test
{
protected:
    AlsPt19Device dev;
    AlsPt19Hw sensor;

    void SetUp() override
    {
        g_mockAdcValue = 0U;
        dev.sensor = nullptr;
        dev.isInitialized = false;
    }
};

TEST_F( AlsPt19Test, InitFailsWithNullDevice )
{
    EXPECT_FALSE( alspt19_init( nullptr, &sensor ) );
}

TEST_F( AlsPt19Test, InitFailsWithNullHw )
{
    EXPECT_FALSE(alspt19_init( &dev, nullptr ) );
}

TEST_F( AlsPt19Test, InitSuccess )
{
    EXPECT_TRUE( alspt19_init( &dev, &sensor ) );
    EXPECT_EQ( dev.sensor, &sensor );
    EXPECT_TRUE( dev.isInitialized );
}

TEST_F( AlsPt19Test, LuxCalculationZero )
{
    float lux = 0.0f;
    EXPECT_TRUE( alspt19_init( &dev, &sensor ) );

    g_mockAdcValue = 0U;
    EXPECT_TRUE( alspt19_read_lux( &dev, &lux ) );
    EXPECT_FLOAT_EQ( lux, 0.0f );
}

TEST_F( AlsPt19Test, LuxCalculationMidScale )
{
    float lux = 0.0f;
    EXPECT_TRUE( alspt19_init( &dev, &sensor ) );

    g_mockAdcValue = 2048U;  // half-scale
    EXPECT_TRUE( alspt19_read_lux( &dev, &lux ) );

    float expected = ( 2048.0f / 4095.0f ) * 1000.0f;
    EXPECT_NEAR( lux, expected, 0.01f );
}

TEST_F( AlsPt19Test, LuxCalculationFullScale )
{
    float lux = 0.0f;
    EXPECT_TRUE( alspt19_init( &dev, &sensor ) );

    g_mockAdcValue = 4095U;  // full-scale
    EXPECT_TRUE( alspt19_read_lux( &dev, &lux ) );

    EXPECT_FLOAT_EQ( lux, 1000.0f );
}
