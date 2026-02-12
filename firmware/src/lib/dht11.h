#ifndef SRC_LIB_DHT11_H
#define SRC_LIB_DHT11_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

typedef struct Dht11Hw Dht11Hw;

/**
 * @brief DHT11 temperature and humidity sensor device instance
 *
 * Represents a logical device instance for the DHT11 sensor, including
 * initialization state and hardware configuration reference.
 *
 * @param sensor        Pointer to hardware configuration structure
 * @param readDelayMs   Delay interval between sensor samples
 * @param isInitialized Initialization status flag
 */
typedef struct Dht11Device
{
    const Dht11Hw * sensor;
    uint32_t readDelayMs;
    bool isInitialized;
} Dht11Device;

/**
 * @brief Initialize the DHT11 sensor device instance
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
bool dht11_init( Dht11Device * device,
                 const Dht11Hw * sensor );

/**
 * @brief Set minimum delay between sensor reads.
 *
 * The DHT11 hardware requires a minimum interval between consecutive samples
 * to ensure accuracy (typically >= 500ms to 2000ms).
 *
 * @param device  Pointer to DHT11 device structure.
 * @param delayMs Delay in milliseconds.
 *
 * @return true  If the delay was updated successfully.
 * @return false If the device not initialized, or invalid parameter
 */
bool dht11_set_delay( Dht11Device * device,
                      uint32_t delayMs );

/**
 * @brief Read temperature value from sensor
 *
 * @param device Pointer to DHT11 device structure
 * @param temperature Pointer to store temperature in °C (integer value)
 *
 * @return true  Read successful and output written
 * @return false Read failed, device not initialized, or invalid parameter
 */
bool dht11_read_temperature( const Dht11Device * device,
                             uint8_t * temperatureOut );

/**
 * @brief Read humidity value from sensor
 *
 * @param device Pointer to DHT11 device structure
 * @param humidity Pointer to store humidity percentage
 *
 * @return true  Read successful and output written
 * @return false Read failed, device not initialized, or invalid parameter
 */
bool dht11_read_humidity( const Dht11Device * device,
                          uint8_t * humidityOut );

/**
 * @brief Read temperature and humidity in a single transaction
 *
 * Performs one sensor read and extracts both values.
 *
 * @param device Pointer to DHT11 device structure
 * @param temperature Pointer to store temperature in °C
 * @param humidity Pointer to store humidity percentage
 *
 * @return true  Read successful and output written
 * @return false Read failed, device not initialized, or invalid parameter
 */
bool dht11_read_temperature_humidity( const Dht11Device * device,
                                      uint8_t * temperatureOut,
                                      uint8_t * humidityOut );

#ifdef __cplusplus
}
#endif

#endif /* SRC_LIB_DHT11_H */
