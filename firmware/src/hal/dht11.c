#include "dht11.h"

#include <stddef.h>

#include <esp_err.h>

#define DHT11_GPIO_LOW   ( 0U )
#define DHT11_GPIO_HIGH  ( 1U )

bool dht11_hal_init( const Dht11Hw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
         esp_err_t err = gpio_reset_pin( sensor->pin );

        if (err == ESP_OK)
        {
            gpio_config_t config =
            {
                .pin_bit_mask = (1ULL << sensor->pin),
                .mode = GPIO_MODE_OUTPUT_OD,
                .pull_up_en = GPIO_PULLUP_ENABLE,
                .pull_down_en = GPIO_PULLDOWN_DISABLE,
                .intr_type = GPIO_INTR_DISABLE,
            };
            err = gpio_config( &config );

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

    if( sensor != NULL )
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

    if( sensor != NULL )
    {
        const esp_err_t err = gpio_set_direction( sensor->pin, GPIO_MODE_OUTPUT_OD );

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

    if( sensor != NULL )
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

    if( ( sensor != NULL ) &&
        ( ( level == DHT11_GPIO_LOW ) || ( level == DHT11_GPIO_HIGH ) ) )
    {
        const esp_err_t err = gpio_set_level( sensor->pin, level );
        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool dht11_hal_read( const Dht11Hw * const sensor,
                     uint32_t * const levelOut )
{
    bool result = false;

    if( ( sensor != NULL ) && ( levelOut != NULL ) )
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
