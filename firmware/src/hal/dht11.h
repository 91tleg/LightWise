#ifndef SRC_HAL_DHT11_H
#define SRC_HAL_DHT11_H

#include <stdbool.h>
#include <stdint.h>

#include <driver/gpio.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct Dht11Hw
{
    gpio_num_t pin;
} Dht11Hw;

/**
 * @brief Initialize the DHT11 hardware interface.
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool dht11_hal_init( const Dht11Hw * sensor );

/**
 * @brief De-initialize the DHT11 hardware interface.
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  De-initialization successful
 * @return false De-initialization failed or invalid parameter
 */
bool dht11_hal_deinit( const Dht11Hw * sensor );

/**
 * @brief Configure the DHT11 gpio pin direction as output.
 * 
 * @param sensor Pointer to hardware configuration structure
 * 
 * @return true  Set output successful
 * @return false Set output failed or invalid parameter
 */
bool dht11_hal_set_output( const Dht11Hw * sensor );

/**
 * @brief Configure the DHT11 gpio pin direction as input.
 * 
 * @param sensor Pointer to hardware configuration structure
 * 
 * @return true  Set input successful
 * @return false Set input failed or invalid parameter
 */
bool dht11_hal_set_input( const Dht11Hw * sensor );

/**
 * @brief Set the level of the DHT11 gpio pin.
 *
 * @param sensor Pointer to hardware configuration structure
 * @param level Pin level to write (0 or 1).
 * 
 * @return true  Set level successful
 * @return false Set level failed or invalid parameter
 */
bool dht11_hal_write( const Dht11Hw * sensor,
                      uint32_t level );

/**
 * @brief Read the level of the DHT11 gpio pin.
 * 
 * @param sensor Pointer to hardware configuration structure
 * @param levelOut Pointer to the output level
 *
 * @return true  Read successful
 * @return false Read failed or invalid parameter
 */
bool dht11_hal_read( const Dht11Hw * sensor,
                     uint32_t * levelOut );

/**
 * @brief Delay execution for a number of milliseconds.
 *
 * Uses FreeRTOS vTaskDelay.
 *
 * @param delayMs Number of milliseconds to delay.
 */
void dht11_hal_delay_ms( uint32_t delayMs );

/**
 * @brief Delay execution for a number of microseconds.
 *
 * Uses ESP ROM delay function.
 *
 * @param delayUs Number of microseconds to delay.
 */
void dht11_hal_delay_us( uint32_t delayUs );

/**
 * @brief Get the current system time in microseconds.
 *
 * @return uint64_t Current time in microseconds.
 */
uint64_t dht11_hal_get_time_us( void );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_DHT11_H */
