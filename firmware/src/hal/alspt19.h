#ifndef SRC_HAL_ALSPT19_H
#define SRC_HAL_ALSPT19_H

#include <stdbool.h>
#include <stdint.h>

#include <esp_adc/adc_oneshot.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Hardware configuration structure for ALS PT19 ambient light sensor
 *
 * @param unit    ADC unit to use for conversion
 * @param channel ADC channel connected to the sensor
 * @param handle  ADC oneshot unit handle for performing conversions
 */
typedef struct AlsPt19Hw
{
    adc_unit_t unit;
    adc_channel_t channel;
    adc_oneshot_unit_handle_t handle;
} AlsPt19Hw;

/**
 * @brief Initialize the ALS PT19 ambient light sensor hardware interface
 *
 * Configures the ADC unit and channel for reading light intensity measurements
 * from the PT19 sensor.
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool alspt19_hal_init( AlsPt19Hw * sensor );

/**
 * @brief De-initialize the ALS PT19 ambient light sensor hardware interface
 *
 * Releases ADC resources and cleans up the hardware interface.
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  De-initialization successful
 * @return false De-initialization failed or invalid parameter
 */
bool alspt19_hal_deinit( AlsPt19Hw * sensor );

/**
 * @brief Read raw ADC conversion value from the ALS PT19 sensor
 *
 * Performs a single ADC conversion and returns the unscaled 12-bit digital value.
 *
 * @param sensor Pointer to hardware configuration structure
 * @param out    Pointer to output buffer for the raw ADC value (0-4095)
 *
 * @return true  Read successful and output written
 * @return false Read failed or invalid parameter
 */
bool alspt19_hal_read_raw( const AlsPt19Hw * sensor,
                           uint16_t * out );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_ALSPT19_H */
