#include "led_detect.h"
#include <stddef.h>
#include <esp_err.h>

bool led_detect_init( LedDetect * const detect )
{
    bool result = false;

    if( detect != NULL )
    {
        const gpio_config_t cfg =
        {
            .pin_bit_mask = ( 1ULL << detect->pin ),
            .mode         = GPIO_MODE_INPUT,
            .pull_up_en   = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type    = GPIO_INTR_DISABLE
        };

        const esp_err_t err = gpio_config( &cfg );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool led_detect_deinit( LedDetect * const detect )
{
    bool result = false;

    if( detect != NULL )
    {
        const esp_err_t err = gpio_reset_pin( detect->pin );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool led_detect_read( LedDetect * const detect, bool * const unplugged )
{
    bool result = false;

    if( ( detect != NULL ) &&
        ( unplugged != NULL ) )
    {
        const int level = gpio_get_level( detect->pin );

        /* HIGH = pin floating via pull-up = LED unplugged
           LOW  = LED + resistor pulling pin to GND = LED present */
        *unplugged = ( level == 1 );
        result = true;
    }

    return result;
}
