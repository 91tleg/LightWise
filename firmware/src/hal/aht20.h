#ifndef SRC_HAL_AHT20_H
#define SRC_HAL_AHT20_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#include <driver/i2c_master.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct I2cBus I2cBus;

typedef struct Aht20Hw
{
    I2cBus * bus;   /**< Shared I2C bus */
    uint16_t addr;  /**< 7-bit I2C device address */
    i2c_master_dev_handle_t handle;  /**< I2C device handle (runtime) */
} Aht20Hw;

/**
 * @brief Attach the Aht20 device to a shared I2C bus.
 *
 * @param hw   Pointer to the LWNode hardware descriptor.
 * @param bus  Pointer to an already-initialised shared I2C bus.
 *
 * @return true if the device was attached successfully, false otherwise.
 */
bool aht20_hal_init( Aht20Hw * hw, I2cBus * bus );

/**
 * @brief Detach the Aht20 device from the I2C bus.
 * Safe to call multiple times.
 *
 * @param hw  Pointer to the LWNode hardware descriptor.
 *
 * @return true if detach succeeded or was already complete, false otherwise.
 */
bool aht20_hal_deinit( Aht20Hw * hw );

/**
 * @brief Write data to a Aht20 register over I2C.
 *
 * @param hw    Pointer to the Aht20 hardware descriptor.
 * @param reg   Register address to write.
 * @param data  Pointer to the data buffer.
 * @param len   Number of bytes to write.
 *
 * @return true if the write succeeded, false otherwise.
 */
bool aht20_hal_write( const Aht20Hw * hw,
                      uint8_t reg,
                      const uint8_t * data,
                      size_t len );

/**
 * @brief Read data from a Aht20 register over I2C.
 *
 * @param hw    Pointer to the Aht20 hardware descriptor.
 * @param reg   Register address to read from.
 * @param data  Buffer to receive the read bytes.
 * @param len   Number of bytes to read.
 *
 * @return true if the read succeeded, false otherwise.
 */
bool aht20_hal_read( const Aht20Hw * hw,
                     uint8_t reg,
                     uint8_t * data,
                     size_t len );

/**
 * @brief Reads raw data from the AHT20 sensor.
 *
 * Reads N bare bytes with no preceding register address.
 *
 * @param hw Pointer to the AHT20 hardware descriptor.
 * @param data Buffer to store the read data.
 * @param len Number of bytes to read.
 * 
 * @return true if the read succeeded, false otherwise.
 */
bool aht20_hal_read_raw( const Aht20Hw * hw,
                         uint8_t * data,
                         size_t len );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_AHT20_H */
