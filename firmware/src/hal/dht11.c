#include "dht11.h"

#include <stddef.h>

#include <esp_err.h>
#include <esp_rom_sys.h>
#include <esp_timer.h>

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#define DHT11_GPIO_LOW   ( 0U )
#define DHT11_GPIO_HIGH  ( 1U )

bool dht11_hal_init( const Dht11Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid argument */
    }
    else
    {
         esp_err_t err = gpio_reset_pin( sensor->pin );

        if (err == ESP_OK)
        {
            err = gpio_set_direction( sensor->pin, GPIO_MODE_OUTPUT );

            if( err == ESP_OK )
            {
                err = gpio_set_level( sensor->pin, DHT11_GPIO_HIGH );

                if( err == ESP_OK )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

bool dht11_hal_deinit( const Dht11Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid argument */
    }
    else 
    {
        const esp_err_t err = gpio_reset_pin( sensor->pin );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool dht11_hal_set_output( const Dht11Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid argument */
    }
    else
    {
        const esp_err_t err = gpio_set_direction( sensor->pin, GPIO_MODE_OUTPUT );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}


bool dht11_hal_set_input( const Dht11Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid argument */
    }
    else
    {
        const esp_err_t err = gpio_set_direction( sensor->pin, GPIO_MODE_INPUT );
        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool dht11_hal_write( const Dht11Hw * const sensor,
                      uint32_t level )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid argument */
    }
    else
    {
        if( ( level == DHT11_GPIO_LOW ) || ( level == DHT11_GPIO_HIGH ) )
        {
            const esp_err_t err = gpio_set_level( sensor->pin, level );
            if( err == ESP_OK )
            {
                result = true;
            }
        }
    }

    return result;
}

bool dht11_hal_read( const Dht11Hw * const sensor,
                     uint32_t * const levelOut )
{
    bool result = false;

    if( ( sensor == NULL ) || ( levelOut == NULL ) )
    {
        /* Invalid argument */
    }
    else
    {
        const int level = gpio_get_level( sensor->pin );

        if( ( level == DHT11_GPIO_LOW ) || ( level == DHT11_GPIO_HIGH ) )
        {
            *levelOut = ( uint32_t ) level;
            result = true;
        }
    }

    return result;
}

void dht11_hal_delay_ms( uint32_t delayMs )
{
    if( delayMs > 0U )
    {
        vTaskDelay( pdMS_TO_TICKS( delayMs ) );
    }
}

void dht11_hal_delay_us( uint32_t delayUs )
{
    if( delayUs > 0U )
    {
        esp_rom_delay_us( delayUs );
    }
}

uint64_t dht11_hal_get_time_us( void )
{
    const int64_t timeUs = esp_timer_get_time();
    uint64_t result = 0U;

    if( timeUs >= 0 )
    {
        result = ( uint64_t ) timeUs;
    }
    else
    {
        /* Fallback */
        result = 0U;
    }

    return result;
}
