#include "alspt19.h"

#include <stddef.h>

#include <esp_err.h>

bool alspt19_hal_init( AlsPt19Hw * const hw,
                       const adc_oneshot_unit_handle_t handle )
{
    bool result = false;

    if( ( hw != NULL ) && ( handle != NULL ) && ( hw->handle == NULL ) )
    {
        const adc_oneshot_chan_cfg_t chanConfig =
        {
            .bitwidth = ADC_BITWIDTH_12,
            .atten    = ADC_ATTEN_DB_12
        };

        const esp_err_t err = adc_oneshot_config_channel( handle,
                                                          hw->channel,
                                                          &chanConfig );
        if( err == ESP_OK )
        {
            hw->handle = handle;
            result = true;
        }
    }

    return result;
}

bool alspt19_hal_deinit( AlsPt19Hw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        if( hw->handle == NULL )
        {
            /* Already deinitialized */
            result = true;
        }
        else
        {
            /* Release borrow only — unit lifetime managed by AdcUnit */
            hw->handle = NULL;
            result = true;
        }
    }

    return result;
}

bool alspt19_hal_read( const AlsPt19Hw * const hw,
                       uint16_t * const out )
{
    bool result = false;

    if( ( hw != NULL ) && ( hw->handle != NULL ) && ( out != NULL ) )
    {
        int raw = 0;
        const esp_err_t err = adc_oneshot_read( hw->handle,
                                                hw->channel,
                                                &raw );
        if( err == ESP_OK )
        {
            *out   = ( uint16_t ) raw;
            result = true;
        }
    }

    return result;
}
