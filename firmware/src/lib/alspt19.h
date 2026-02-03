#ifndef SRC_LIB_ALSPT19_H
#define SRC_LIB_ALSPT19_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct AlsPt19Hw AlsPt19Hw;

/**
 * @brief ALS PT19 ambient light sensor device instance
 *
 * Represents a logical device instance for the PT19 sensor, including
 * initialization state and hardware configuration reference.
 *
 * @param sensor        Pointer to hardware configuration structure
 * @param isInitialized Initialization status flag
 */
typedef struct AlsPt19Device
{
    const AlsPt19Hw * sensor;
    bool isInitialized;
} AlsPt19Device;

/**
 * @brief Initialize the ALS PT19 sensor device instance
 *
 * Sets up the logical device structure and initializes the underlying
 * hardware interface.
 *
 * @param device Pointer to device instance to initialize
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool alspt19_init( AlsPt19Device * device,
                   const AlsPt19Hw * sensor );

/**
 * @brief Read illuminance from the ALS PT19 sensor
 *
 * Performs an ADC conversion and converts the raw value to illuminance
 * in lux using the PT19 sensor characteristics.
 *
 * @param device  Pointer to initialized device instance
 * @param luxOut  Pointer to output buffer for illuminance value in lux
 *
 * @return true  Read successful and output written
 * @return false Read failed, device not initialized, or invalid parameter
 */
bool alspt19_read_lux( const AlsPt19Device * device,
                       float * luxOut );

#ifdef __cplusplus
}
#endif

#endif /* SRC_LIB_ALSPT19_H */
