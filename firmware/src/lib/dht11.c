#include "dht11.h"

#include <stddef.h>

#include "hal/dht11.h"

#define DHT11_START_SIGNAL_MS       ( 18U )
#define DHT11_BIT_SAMPLE_DELAY_US   ( 30U )
#define DHT11_TIMEOUT_US            ( 100U )
#define DHT11_DEFAULT_READ_DELAY_MS ( 500U )

static bool dht11_start_signal( const Dht11Device * device );
static bool dht11_read_raw( const Dht11Device * device, uint8_t data[ 5 ] );
static bool dht11_read_byte( const Dht11Device * device, uint8_t * byteOut );
static bool dht11_wait_level( const Dht11Device * device, uint8_t level, uint32_t timeoutUs );

bool dht11_init( Dht11Device * const device,
                 const Dht11Hw * const sensor )
{
    bool result = false;

    if( ( device == NULL ) || ( sensor == NULL ) )
    {
        /* Invalid argument */
    }
    else if( device->isInitialized )
    {
        /* Already initialized */
    }
    else
    {
        device->sensor = sensor;
        device->readDelayMs = DHT11_DEFAULT_READ_DELAY_MS;
        device->isInitialized = true;
        result = true;
    }

    return result;
}

bool dht11_set_delay( Dht11Device * const device,
                      uint32_t delayMs )
{
    bool result = false;

    if( device == NULL )
    {
        /* Invalid device pointer */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        device->readDelayMs = delayMs;
        result = true;
    }

    return result;
}

bool dht11_read_temperature( const Dht11Device * const device,
                             uint8_t * const temperatureOut )
{
    bool result = false;
    
    if( ( device == NULL ) || ( temperatureOut == NULL ) )
    {
        /* Invalid argument */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        uint8_t ucData[ 5 ] = { 0U };
        if( dht11_read_raw( device, ucData ) )
        {
            *temperatureOut = ucData[ 2 ];
            result = true;
        }
    }

    return result;
}

bool dht11_read_humidity( const Dht11Device * const device,
                          uint8_t * const humidityOut )
{
    bool result = false;

    if( ( device == NULL ) || ( humidityOut == NULL ) )
    {
        /* Invalid argument */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {   
        uint8_t ucData[ 5 ] = { 0U };
        if( dht11_read_raw( device, ucData ) )
        {
            *humidityOut = ucData[ 0 ];
            result = true;
        }
    }

    return result;
}

bool dht11_read_temperature_humidity( const Dht11Device * const device,
                                      uint8_t * const temperatureOut,
                                      uint8_t * const humidityOut )
{
    bool result = false;
    
    if( ( device == NULL ) || 
        ( temperatureOut == NULL ) || ( humidityOut == NULL  ) )
    {
        /* Invalid argument */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        uint8_t ucData[ 5 ] = { 0U };
        if( dht11_read_raw( device, ucData ) )
        {
            *humidityOut = ucData[ 0 ];
            *temperatureOut = ucData[ 2 ];
            result = true;
        }
    }

    return result;
}

static bool dht11_read_raw( const Dht11Device * const device, 
                            uint8_t data[ 5 ] )
{
    bool result = false;

    if( ( device == NULL ) || ( data == NULL ) )
    {
        /* Invalid argument */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        uint8_t index = 0U;
        for( index = 0U; index < 5U; ++index )
        {
            data[ index ] = 0U;
        }
        
        dht11_hal_delay_ms( device->readDelayMs );

        if( dht11_start_signal( device ) )
        {
            /* Wait for sensor response: low */
            if( dht11_wait_level( device, 0U, DHT11_TIMEOUT_US ) )
            {
                /* Wait for sensor response: high */
                if( dht11_wait_level( device, 1U, DHT11_TIMEOUT_US ) )
                {
                    /* Read 5 bytes */
                    result = true;
                    for( index = 0U; index < 5U; ++index )
                    {
                        if( !dht11_read_byte(device, &data[index]) )
                        {
                            /* Read byte failed */
                            result = false;
                            break;
                        }
                    }

                    /* Verify checksum */
                    if( result )
                    {
                        const uint8_t checksum = ( uint8_t ) ( data[ 0 ] + data[ 1 ] + data[ 2 ] + data[ 3 ] );
                        if( checksum != data[ 4 ] )
                        {
                            /* Checksum mismatch */
                            result = false;
                        }
                    }
                }
            }
        }
    }
    return result;
}

static bool dht11_read_byte( const Dht11Device * const device,
                             uint8_t * const byteOut )
{
    bool result = true;

    if( ( device == NULL ) || ( byteOut == NULL ) )
    {
        /* Invalid argument */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        *byteOut = 0U;
        uint8_t bitIndex = 0U;
        result = true;

        for( bitIndex = 0U; bitIndex < 8U; ++bitIndex )
        {
            if( !dht11_wait_level( device, 0U, DHT11_TIMEOUT_US ) )
            {
                /* Wait low pulse failed */
                result = false;
                break;
            }

            if( !dht11_wait_level( device, 1U, DHT11_TIMEOUT_US ) )
            {
                /* Wait high pulse failed */
                result = false;
                break;
            }

            uint32_t level = 0U;

            dht11_hal_delay_us( DHT11_BIT_SAMPLE_DELAY_US );

            if( !dht11_hal_read( device->sensor, &level ) )
            {
                result = false;
                break;
            }
            
            if( level == 1U )
            {
                *byteOut |= ( 1U << ( 7U - bitIndex ) );
            }
        }
    }

    return result;
}

static bool dht11_start_signal( const Dht11Device * const device )
{
    bool result = true;

    if( device == NULL )
    {
        /* Invalid device pointer */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        if( dht11_hal_set_output( device->sensor ) )
        {
            /* Pull line low to start signal */
            if( dht11_hal_write( device->sensor, 0U ) )
            {
                dht11_hal_delay_ms( DHT11_START_SIGNAL_MS );

                /* Release line */
                if( dht11_hal_write( device->sensor, 1U ) )
                {
                    dht11_hal_delay_us( 40U );

                    /* Switch to input to read response */
                    if( dht11_hal_set_input( device->sensor ) )
                    {
                        result = true;
                    }
                }
            }
        }
    }
    return result;
}

static bool dht11_wait_level( const Dht11Device * const device,
                              uint8_t expectedLevel,
                              uint32_t timeoutUs )
{
    bool result = false;

    if( device == NULL )
    {
        /* Invalid device */
    }
    else if( !device->isInitialized )
    {
        /* Device not initialized */
    }
    else
    {
        if( expectedLevel != 0U )
        {
            expectedLevel = 1U;
        }

        const uint64_t startTimeUs = dht11_hal_get_time_us();
        bool timeoutExpired = false;

        while ( !result && !timeoutExpired )
        {
            uint32_t currentLevel = 0U;

            if( !dht11_hal_read( device->sensor, &currentLevel ) )
            {
                break;
            }
            else if( currentLevel == expectedLevel )
            {
                result = true;
            }
            else
            {
                const uint64_t currentTimeUs = dht11_hal_get_time_us();
                const uint64_t elapsedUs = currentTimeUs - startTimeUs;

                if( elapsedUs > ( uint64_t ) timeoutUs )
                {
                    timeoutExpired = true;
                }
            }
        }
    }

    return result;
}
