#ifndef SRC_HAL_ADC_UNITS_H
#define SRC_HAL_ADC_UNITS_H

#include <stdbool.h>

#include <esp_adc/adc_oneshot.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct AdcUnit
{
    adc_unit_t unit;
    adc_oneshot_unit_handle_t handle;
} AdcUnit;

bool adc_unit_init( AdcUnit * unit );

bool adc_unit_deinit( AdcUnit * unit );

#ifdef __cplusplus
} 
#endif

#endif /* SRC_HAL_ADC_UNITS_H */