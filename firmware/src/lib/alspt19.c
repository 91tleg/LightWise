#include "alspt19.h"

#include <stddef.h>

#include "hal/alspt19.h"

#define ALSPT19_ADC_MAX_COUNTS   ( 4095U )
#define ALSPT19_MAX_LUX          ( 1000.0f )

static inline float alspt19_adc_to_lux( uint16_t rawReading );

bool alspt19_init( AlsPt19Device * const device,
                   const AlsPt19Hw * const sensor )
{
    bool result = false;

    if( device == NULL )
    {
        /* Invalid device pointer */
    }
    else if( sensor == NULL )
    {
        /* Invalid sensor pointer */
    }
    else if( device->isInitialized )
    {
        /* Already initialized */
    }
    else
    {
        device->sensor = sensor;
        device->isInitialized = true;
        result = true;
    }

    return result;
}

bool alspt19_read_lux( const AlsPt19Device * const device,
                       float * const luxOut )
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
    else if( luxOut == NULL )
    {
        /* Invalid otput pointer */
    }
    else
    {
        uint16_t rawReading = 0U;

        if( !alspt19_hal_read_raw( device->sensor, &rawReading ) )
        {
            /* ADC read failed */
        }
        else
        {
            *luxOut = alspt19_adc_to_lux( rawReading );
            result = true;
        } 
    }

    return result;
}

static inline float alspt19_adc_to_lux( uint16_t rawReading )
{
    float lux = ( ( float ) rawReading 
                  / ( float ) ALSPT19_ADC_MAX_COUNTS )
                  * ALSPT19_MAX_LUX;
    
    return lux;
}
