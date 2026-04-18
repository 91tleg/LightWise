#ifndef SRC_HAL_LWNODE_H
#define SRC_HAL_LWNODE_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#include <driver/i2c_master.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct I2cBus I2cBus;

typedef struct LwnodeHw
{
    I2cBus * bus;   /**< Shared I2C bus */
    uint16_t addr;  /**< 7-bit I2C device address */
    i2c_master_dev_handle_t handle;  /**< I2C device handle (runtime) */
} LwnodeHw;

/**
 * @brief Attach the LWNode device to a shared I2C bus.
 *
 * @param hw   Pointer to the LWNode hardware descriptor.
 * @param bus  Pointer to an already-initialised shared I2C bus.
 *
 * @return true if the device was attached successfully, false otherwise.
 */
bool lwnode_hal_init( LwnodeHw * hw, I2cBus * bus );

/**
 * @brief Detach the LWNode device from the I2C bus.
 * Safe to call multiple times.
 *
 * @param hw  Pointer to the LWNode hardware descriptor.
 *
 * @return true if detach succeeded or was already complete, false otherwise.
 */
bool lwnode_hal_deinit( LwnodeHw * hw );

/**
 * @brief Write data to a LWNode register over I2C.
 *
 * @param hw    Pointer to the LWNode hardware descriptor.
 * @param reg   Register address to write.
 * @param data  Pointer to the data buffer.
 * @param len   Number of bytes to write.
 *
 * @return true if the write succeeded, false otherwise.
 */
bool lwnode_hal_write( const LwnodeHw * hw,
                       uint8_t reg,
                       const uint8_t * data,
                       size_t len );

/**
 * @brief Read data from a LWNode register over I2C.
 *
 * @param hw    Pointer to the LWNode hardware descriptor.
 * @param reg   Register address to read from.
 * @param data  Buffer to receive the read bytes.
 * @param len   Number of bytes to read.
 *
 * @return true if the read succeeded, false otherwise.
 */
bool lwnode_hal_read( const LwnodeHw * hw,
                      uint8_t reg,
                      uint8_t * data,
                      size_t len );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_LWNODE_H */
