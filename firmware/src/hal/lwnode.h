#ifndef SRC_HAL_LWNODE_H
#define SRC_HAL_LWNODE_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#include <driver/gpio.h>
#include <driver/i2c_master.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct LwnodeHw
{
    /* Static configuration */
    i2c_port_t port;       /**< I2C port used to communicate with the device */
    gpio_num_t sclPin;     /**< GPIO number used for I2C SCL */
    gpio_num_t sdaPin;     /**< GPIO number used for I2C SDA */
    uint16_t i2cAddr;      /**< 7-bit I2C device address */

    /* Runtime-managed handles */
    i2c_master_bus_handle_t busHandle;  /**< I2C master bus handle */
    i2c_master_dev_handle_t devHandle;  /**< I2C device handle */
} LwnodeHw;

/**
 * @brief Initialize the LWNode I2C hardware interface.
 *
 * Configures and initializes the I2C master bus and attaches the LWNode
 * device to the bus using the parameters provided in the hardware descriptor.
 *
 * @param sensor  Pointer to the LWNode hardware configuration structure.
 *
 * @return true if initialization succeeded, false otherwise.
 */
bool lwnode_hal_init( LwnodeHw * sensor );

/**
 * @brief Deinitialize the LWNode I2C hardware interface.
 *
 * Removes the device from the I2C bus and deletes the master bus instance.
 * Safe to call multiple times.
 *
 * @param sensor  Pointer to the LWNode hardware configuration structure.
 *
 * @return true if deinitialization succeeded or was already complete,
 *         false otherwise.
 */
bool lwnode_hal_deinit( LwnodeHw * sensor );

/**
 * @brief Write data to a LWNode register over I2C.
 *
 * Performs a register write by sending the register address followed by
 * the specified data bytes in a single I2C transaction.
 *
 * @param sensor  Pointer to the LWNode hardware configuration structure.
 * @param reg     Register address to write.
 * @param data    Pointer to the data buffer to write.
 * @param len     Number of bytes to write.
 *
 * @return true if the write operation succeeded, false otherwise.
 */
bool lwnode_hal_write( const LwnodeHw * sensor,
                       uint8_t reg,
                       const uint8_t * data,
                       size_t len );

/**
 * @brief Read data from a LWNode register over I2C.
 *
 * Writes the register address and then reads the specified number of bytes
 * from the device in a combined I2C transaction.
 *
 * @param sensor  Pointer to the LWNode hardware configuration structure.
 * @param reg     Register address to read from.
 * @param data    Pointer to the buffer where read data will be stored.
 * @param len     Number of bytes to read.
 *
 * @return true if the read operation succeeded, false otherwise.
 */
bool lwnode_hal_read( const LwnodeHw * sensor,
                      uint8_t reg,
                      uint8_t * data,
                      size_t len );

/**
 * @brief Delay execution for a specified number of milliseconds.
 *
 * Uses the FreeRTOS scheduler to delay the calling task.
 *
 * @param delayMs  Delay duration in milliseconds.
 */
void lwnode_hal_delay_ms( uint32_t delayMs );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_LWNODE_H */
