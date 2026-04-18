#ifndef SRC_HAL_I2C_BUS_H
#define SRC_HAL_I2C_BUS_H

#include <stdint.h>
#include <stdbool.h>

#include <driver/i2c_master.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Structure representing an I2C bus configuration.
 */
typedef struct I2cBus
{
    i2c_port_t port;  /**< I2C port used to communicate with the device */
    gpio_num_t scl;   /**< GPIO number used for I2C SCL */
    gpio_num_t sda;   /**< GPIO number used for I2C SDA */
    i2c_master_bus_handle_t handle; /**< Handle to the I2C master bus */
} I2cBus;

/**
 * @brief Initializes an I2C bus.
 *
 * @param bus Pointer to the I2cBus structure to initialize.
 * @return true if initialization succeeded, false otherwise.
 */
bool i2c_bus_init ( I2cBus * bus );

/**
 * @brief De-initialize an I2C bus.
 *
 * @param bus Pointer to the I2cBus structure to de-initialize.
 * @return true if de-initialization succeeded, false otherwise.
 */
bool i2c_bus_deinit( I2cBus * bus );

/**
 * @brief Adds a device to the I2C bus.
 *
 * @param bus Pointer to the I2cBus structure.
 * @param addr 7-bit I2C address of the device.
 * @param out Pointer to store the device handle.
 * @return true if device was added successfully, false otherwise.
 */
bool i2c_bus_add_device ( I2cBus * bus,
                          uint16_t addr,
                          i2c_master_dev_handle_t * out );

/**
 * @brief Removes a device from the I2C bus.
 *
 * @param dev Handle to the I2C device to remove.
 * @return true if device was removed successfully, false otherwise.
 */
bool i2c_bus_remove_device( i2c_master_dev_handle_t dev );

/**
 * @brief Writes data to an I2C device register.
 *
 * @param dev Handle to the I2C device.
 * @param reg Register address to write to.
 * @param data Pointer to the data buffer to write.
 * @param len Length of the data to write.
 * @return true if write succeeded, false otherwise.
 */
bool i2c_bus_write( i2c_master_dev_handle_t dev,
                    uint8_t reg,
                    const uint8_t * data,
                    size_t len );

/**
 * @brief Reads data from an I2C device register.
 *
 * @param dev Handle to the I2C device.
 * @param reg Register address to read from.
 * @param data Pointer to the buffer to store read data.
 * @param len Number of bytes to read.
 * @return true if read succeeded, false otherwise.
 */
bool i2c_bus_read ( i2c_master_dev_handle_t dev,
                    uint8_t reg,
                    uint8_t * data,
                    size_t len );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_I2C_BUS_H */
