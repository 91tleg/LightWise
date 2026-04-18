#include <cstdint>
#include <array>

#include <gtest/gtest.h>

#include "hal/aht20.h"
#include "lib/th/aht20.hpp"

namespace
{

    uint8_t mockStatusVal { 0x08U };
    bool mockWriteRet { true };
    bool mockReadRawRet { true };
    std::array< uint8_t, 6U > mockPayload { 0 };

} /* anonymous namespace */

extern "C" {
    bool aht20_hal_write( const Aht20Hw * hw,
                          uint8_t reg,
                          const uint8_t * data,
                          size_t len )
    {
        return mockWriteRet;
    }

    bool aht20_hal_read_raw( const Aht20Hw * hw,
                             uint8_t * data,
                             size_t len )
    {
        bool ok { false };

        if( mockReadRawRet )
        {
            if( len == 1 )
            {
                data[ 0U ] = mockStatusVal;
            }
            else if( len == 6 )
            {
                for( size_t i { 0U }; i < 6U; ++i )
                {
                    data[ i ] = mockPayload[ i ];
                }
            }
            else
            {

            }
            ok = true;
        }

        return ok;
    }

    bool aht20_hal_init( Aht20Hw * hw, I2cBus * bus )
    {
        return true;
    }

    bool aht20_hal_deinit( Aht20Hw * hw )
    {
        return true;
    }

    bool aht20_hal_read( const Aht20Hw * hw,
                         uint8_t reg,
                         uint8_t * data,
                         size_t len )
    {
        return true;
    }

    void delay_ms( uint32_t delayMs )
    {
        static_cast< void >( delayMs );
    }
}

class Aht20Test : public ::testing::Test
{
protected:
    const Aht20Hw hw {};

    void SetUp() override
    {
        mockStatusVal = 0x08U;
        mockWriteRet = true;
        mockReadRawRet = true;
        mockPayload.fill( 0U );
    }
};

TEST_F( Aht20Test, InitSuccessWhenCalibrated )
{
    th::Aht20 sensor { hw };
    
    mockStatusVal = 0x08U;
    EXPECT_TRUE( sensor.init() );
}

TEST_F( Aht20Test, InitFailsWhenNotCalibrated )
{
    th::Aht20 sensor { hw };
    
    mockStatusVal = 0x00U;
    EXPECT_FALSE( sensor.init() );
}

TEST_F( Aht20Test, ReadCalculatesCorrectValues )
{
    th::Aht20 sensor { hw };

    mockPayload[ 0U ] = 0x00U;
    mockPayload[ 1U ] = 0x80U;
    mockPayload[ 2U ] = 0x00U;
    mockPayload[ 3U ] = 0x06U;
    mockPayload[ 4U ] = 0x00U;
    mockPayload[ 5U ] = 0x00U;

    int8_t t { 0 };
    uint8_t h { 0U };
    
    ASSERT_TRUE( sensor.read( t, h ) );
    EXPECT_EQ( t, 25 );
    EXPECT_EQ( h, 50U );
}

TEST_F( Aht20Test, ReadFailsIfHalWriteFails )
{
    th::Aht20 sensor { hw };
    
    mockWriteRet = false;
    
    int8_t t { 0 };
    uint8_t h { 0U };

    EXPECT_FALSE( sensor.read( t, h ) );
}

TEST_F( Aht20Test, ReadFailsOnBusyTimeout )
{
    th::Aht20 sensor { hw };
    
    mockStatusVal = 0x80U;
    
    int8_t t { 0 };
    uint8_t h { 0U };

    EXPECT_FALSE( sensor.read( t, h ) );
}
