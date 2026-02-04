#include <array>
#include <cstdint>
#include <gtest/gtest.h>

#include "hal/dht11.h"
#include "lib/dht11.h"

static Dht11Hw g_mockSensor;
static std::array<uint8_t, 5> g_mockData;

static int g_phase = 0;          // 0 = handshake LOW, 1 = handshake HIGH, 2+ = data bits
static int g_bitCount = 0;       // total data bits read
static int g_subPhase = 0;       // 0 = LOW pulse, 1 = HIGH pulse
// ------------------ HAL MOCKS ------------------
bool dht11_hal_set_output( const Dht11Hw * sensor )
{
    (void) sensor;
    return true;
}
bool dht11_hal_set_input( const Dht11Hw * sensor )
{
    (void) sensor;
    return true;
}
bool dht11_hal_write( const Dht11Hw * sensor, 
                      uint32_t level )
{
    (void) sensor;
    (void) level;
    return true;
}
void dht11_hal_delay_ms( uint32_t ms )
{
    (void) ms;
}
void dht11_hal_delay_us( uint32_t us )
{
    (void) us;
}
uint64_t dht11_hal_get_time_us( void )
{
    static uint64_t t = 0;
    t += 100;
    return t;
}

bool dht11_hal_read( const Dht11Hw * sensor, 
                     uint32_t * level )
{
    ( void ) sensor;

    /* Handshake phase */
    if( g_phase == 0 )
    {
        *level = 0U; /* Satisfies wait for LOW */
        g_phase = 1;
        return true;
    }
    else if( g_phase == 1 )
    {
        *level = 1U; /* Satisfies wait for HIGH */
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
        /* Lib is calling wait_level(0) */
        *level = 0U;
        g_subPhase = 1;
    }
    else if( g_subPhase == 1 )
    {
        /* Library is calling wait_level(1) */
        *level = 1U;
        g_subPhase = 2;
    }
    else
    {
        /* Library is calling dht11_hal_read to sample the bit value */
        *level = ( g_mockData[ byteIndex ] >> bitInByte ) & 0x01;
        g_subPhase = 0; /* Reset for next bit */
        g_bitCount++;
    }

    return true;
}

class Dht11Test : public ::testing::Test
{
  protected:
    Dht11Device dev;

    void SetUp() override
    {
        dev.isInitialized = false;
        dev.sensor = nullptr;
        dev.readDelayMs = 0U;
        g_mockData.fill( 0U );

        g_phase = 0;
        g_bitCount = 0;
        g_subPhase = 0;
    }
};

TEST_F( Dht11Test, InitFailsWithNullDevice )
{
    EXPECT_FALSE( dht11_init( nullptr, &g_mockSensor ) );
}

TEST_F( Dht11Test, InitFailsWithNullSensor )
{
    EXPECT_FALSE( dht11_init( &dev, nullptr ) );
}

TEST_F( Dht11Test, InitSuccess )
{
    EXPECT_TRUE( dht11_init( &dev, &g_mockSensor ) );
    EXPECT_EQ( dev.sensor, &g_mockSensor );
    EXPECT_TRUE( dev.isInitialized );
}

TEST_F( Dht11Test, ReadTemperature )
{
    g_mockData = { 40, 0, 25, 0, 65 }; /* humidity=40, temp=25, checksum correct */
    EXPECT_TRUE( dht11_init( &dev, &g_mockSensor ) );

    uint8_t temperature = 0;
    EXPECT_TRUE( dht11_read_temperature( &dev, &temperature ) );
    EXPECT_EQ( temperature, 25 );
}

TEST_F( Dht11Test, ReadHumidity )
{
    g_mockData = { 50, 0, 20, 0, 70 }; /* humidity=50, temp=20, checksum correct */
    EXPECT_TRUE( dht11_init( &dev, &g_mockSensor ) );

    uint8_t humidity = 0;
    EXPECT_TRUE( dht11_read_humidity( &dev, &humidity ) );
    EXPECT_EQ( humidity, 50 );
}

TEST_F( Dht11Test, ReadTemperatureHumidity )
{
    g_mockData = { 55, 0, 22, 0, 77 }; /* humidity=55, temp=22, checksum correct */
    EXPECT_TRUE( dht11_init( &dev, &g_mockSensor ) );

    uint8_t temp = 0, hum = 0;
    EXPECT_TRUE( dht11_read_temperature_humidity( &dev, &temp, &hum ) );
    EXPECT_EQ( temp, 22 );
    EXPECT_EQ( hum, 55 );
}

TEST_F( Dht11Test, FailsOnBadChecksum )
{
    g_mockData = { 40, 0, 25, 0, 0 }; /* bad checksum */
    EXPECT_TRUE( dht11_init( &dev, &g_mockSensor ) );

    uint8_t temp = 0, hum = 0;
    EXPECT_FALSE( dht11_read_temperature_humidity( &dev, &temp, &hum ) );
}
