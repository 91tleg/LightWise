#include <gtest/gtest.h>
#include <cstdint>

#include "hal/led.h"
#include "lib/light/led.hpp"

static uint32_t g_lastPwmValue = 0U;
static bool g_halReturnSuccess = true;

extern "C"
{
    bool led_hal_set_level( const LedHw * sensor, uint32_t level )
    {
        if ( sensor == nullptr ) 
        {
            return false;
        }
        g_lastPwmValue = level;
        return g_halReturnSuccess;
    }
}

class LedTest : public ::testing::Test
{
protected:
    const LedHw hw{};

    void SetUp() override
    {
        g_lastPwmValue = 0U;
        g_halReturnSuccess = true;
    }
};

TEST_F( LedTest, InitSuccess )
{
    light::Led led( &hw );
    EXPECT_TRUE( led.init() );
}

TEST_F( LedTest, InitFailsWithNullHw )
{
    light::Led led( nullptr );
    EXPECT_FALSE( led.init() );
}

TEST_F( LedTest, SetLevelUpdatesPwmWithGamma )
{
    light::Led led( &hw );
    ASSERT_TRUE( led.init() );

    /* 0% level */
    EXPECT_TRUE( led.setLevel( 0U ) );
    EXPECT_EQ( g_lastPwmValue, 0U );

    /* 10% level (Gamma Table index 10 is 59U) */
    EXPECT_TRUE( led.setLevel( 10U ) );
    EXPECT_EQ( g_lastPwmValue, 59U );

    /* 50% level (Gamma Tableindex 50 is 1839U) */
    EXPECT_TRUE( led.setLevel( 50U ) );
    EXPECT_EQ( g_lastPwmValue, 1839U );
}

TEST_F( LedTest, SetLevelClampsAtMax )
{
    light::Led led( &hw );
    ASSERT_TRUE( led.init() );

    /* 100% level should be the 12-bit max (4095U) */
    EXPECT_TRUE( led.setLevel( 100U ) );
    EXPECT_EQ( g_lastPwmValue, 4095U );

    /* Anything above 100 should return false */
    EXPECT_FALSE( led.setLevel( 101U ) );
}

TEST_F( LedTest, GetLevelReturnsLastSet )
{
    light::Led led( &hw );
    ASSERT_TRUE( led.init() );

    uint8_t level = 0U;
    led.setLevel( 42U );
    
    EXPECT_TRUE( led.getLevel( level ) );
    EXPECT_EQ( level, 42U );
}

TEST_F( LedTest, FailsIfNotInitialized )
{
    light::Led led( &hw );
    
    /* Set level before .init() */
    EXPECT_FALSE( led.setLevel( 50U ) );
    
    uint8_t level = 0;
    EXPECT_FALSE( led.getLevel( level ) );
}

TEST_F( LedTest, FailsWhenHalFails )
{
    light::Led led( &hw );
    ASSERT_TRUE( led.init() );

    g_halReturnSuccess = false;
    
    /* Even if input is valid, if HAL fails setLevel should return false */
    EXPECT_FALSE( led.setLevel( 10 ) );
}
