#include "adc_units.h"

#include <stddef.h>

#include <esp_err.h>

bool adc_unit_init( AdcUnit * const unit )
{
    bool result = false;

    if( ( unit != NULL ) && ( unit->handle == NULL ) )
    {
        const adc_oneshot_unit_init_cfg_t initConfig =
        {
            .unit_id = unit->unit
        };
        const esp_err_t err = adc_oneshot_new_unit( &initConfig,
                                                    &unit->handle );
        result = ( err == ESP_OK );
    }

    return result;
}

bool adc_unit_deinit( AdcUnit * const unit )
{
    bool result = false;

    if( unit != NULL )
    {
        if( unit->handle == NULL )
        {
            /* Already deinitialized */
            result = true;
        }
        else
        {
            const esp_err_t err = adc_oneshot_del_unit( unit->handle );
            if( err == ESP_OK )
            {
                unit->handle = NULL;
                result = true;
            }
        }
    }

    return result;
}
