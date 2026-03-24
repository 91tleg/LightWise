#include <array>
#include <cstdint>
#include <gtest/gtest.h>

#include "hal/dht11.h"
#include "lib/th/dht11.hpp"

static std::array< uint8_t, 5 > g_mockData {};

static int g_phase { 0 };    /* 0 = handshake LOW, 1 = handshake HIGH, 2+ = data bits */
static int g_bitCount { 0 }; /* total data bits read */
static int g_subPhase { 0 }; /* 0 = LOW pulse, 1 = HIGH pulse */

extern "C"
{
    bool dht11_hal_set_output( const Dht11Hw * sensor )
    {
        static_cast< void >( sensor );
        return true;
    }

    bool dht11_hal_set_input( const Dht11Hw * sensor )
    {
        static_cast< void >( sensor );
        return true;
    }

    bool dht11_hal_write( const Dht11Hw * sensor, uint32_t level )
    {
        static_cast< void >( sensor );
        static_cast< void >( level );
        return true;
    }

    bool dht11_hal_read( const Dht11Hw * sensor, uint32_t * level )
    {
        static_cast< void >( sensor );

        /* Handshake phase */
        if( g_phase == 0 )
        {
            *level = 0U; /* Wait for LOW */
            g_phase = 1;
            return true;
        }
        else if( g_phase == 1 )
        {
            *level = 1U; /* Wait for HIGH */
            g_phase = 2; /* Move to data phase */
            g_bitCount = 0;
            g_subPhase = 0;
            return true;
        }
        else
        {
            /* Nothing */
        }

        /* Data bits phase */
        if( g_bitCount >= 40 )
        {
            *level = 1U;
            return true;
        }

        int byteIndex = g_bitCount / 8;
        int bitInByte = 7 - ( g_bitCount % 8 );

        if( g_subPhase == 0 )
        {
            /* wait_level(0) */
            *level = 0U;
            g_subPhase = 1;
        }
        else if( g_subPhase == 1 )
        {
            /* wait_level(1) */
            *level = 1U;
            g_subPhase = 2;
        }
        else
        {
            /* dht11_hal_read */
            *level = ( g_mockData[ byteIndex ] >> bitInByte ) & 0x01;
            g_subPhase = 0; /* Reset for next bit */
            g_bitCount++;
        }

        return true;
    }

    void delay_ms( uint32_t ms )
    {
        static_cast< void >( ms );
    }

    void delay_us( uint32_t us )
    {
        static_cast< void >( us );
    }

    uint64_t timer_get_time_us( void )
    {
        static uint64_t t { 0U };
        t += 100;
        return t;
    }
}

class Dht11Test : public ::testing::Test
{
  protected:
    const Dht11Hw hw {};

    void SetUp() override
    {
        g_mockData.fill( 0U );
        g_phase = 0;
        g_bitCount = 0;
        g_subPhase = 0;
    }
};

TEST_F( Dht11Test, ReadSuccess )
{
    g_mockData = { 55, 0, 22, 0, 77 }; /* 55 + 22 = 77 */
    th::Dht11 dev { hw };

    uint8_t temp { 0U };
    uint8_t hum  { 0U };
    EXPECT_TRUE( dev.read( temp, hum ) );
    EXPECT_EQ( temp, 22 );
    EXPECT_EQ( hum, 55 );
}

TEST_F( Dht11Test, ReadFailsOnBadChecksum )
{
    g_mockData = { 55, 0, 22, 0, 99 }; /* Wrong checksum */
    th::Dht11 dev { hw };

    uint8_t temp { 0U };
    uint8_t hum  { 0U };
    EXPECT_FALSE( dev.read( temp, hum ) );
}

TEST_F( Dht11Test, ReadFailsOnProtocolTimeout )
{
    th::Dht11 dev { hw };

    g_phase = 99;

    uint8_t temp { 0U };
    uint8_t hum  { 0U };
    EXPECT_FALSE( dev.read( temp, hum ) );
}
