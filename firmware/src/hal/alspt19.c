#include "alspt19.h"

#include <stddef.h>

#include <esp_err.h>

bool alspt19_hal_init( AlsPt19Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid sensor pointer */
    }
    else if( sensor->handle != NULL )
    {
        /* Already initialized */
    }
    else
    {
        const adc_oneshot_unit_init_cfg_t init_config =
        {
            .unit_id = sensor->unit
        };

        esp_err_t err = adc_oneshot_new_unit( &init_config, 
                                              &sensor->handle );
        if( err != ESP_OK )
        {
            /* Allocation failed */
        }
        else
        {
            const adc_oneshot_chan_cfg_t chan_config =
            {
                .bitwidth = ADC_BITWIDTH_12,
                .atten    = ADC_ATTEN_DB_12
            };

            err = adc_oneshot_config_channel( sensor->handle,
                                              sensor->channel,
                                              &chan_config );
            if( err != ESP_OK )
            {
                /* Channel config failed, cleanup */
                err = adc_oneshot_del_unit( sensor->handle );
                if( err != ESP_OK )
                {
                    /* Delete unit handle failed */
                }
                else
                {
                    sensor->handle = NULL;
                }
            }
            else
            {
                result = true;
            }
        }
    }

    return result;
}

bool alspt19_hal_deinit( AlsPt19Hw * const sensor )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid sensor pointer */
    }
    else if( sensor->handle == NULL )
    {
        /* Already deinitialized */
        result = true;
    }
    else
    {
        const esp_err_t err = adc_oneshot_del_unit( sensor->handle );
        if( err != ESP_OK )
        {
            /* Delete unit handle failed */
        }
        else
        {
            sensor->handle = NULL;
            result = true;
        }
    }

    return result;
}

bool alspt19_hal_read_raw( const AlsPt19Hw * const sensor,
                           uint16_t * const out )
{
    bool result = false;

    if( sensor == NULL )
    {
        /* Invalid sensor pointer */
    }
    else if( sensor->handle == NULL )
    {
        /* ADC not initialized */
    }
    else if( out == NULL )
    {
        /* Invalid otput pointer */
    }
    else
    {
        int raw = 0;
        const esp_err_t err = adc_oneshot_read( sensor->handle,
                                                sensor->channel,
                                                &raw );

        if( err != ESP_OK )
        {
            /* ADC read failed */
        }
        else
        {
            *out = ( uint16_t ) raw;
            result = true;
        }
    }

    return result;
}
