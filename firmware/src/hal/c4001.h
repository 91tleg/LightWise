#ifndef SRC_HAL_C4001_H
#define SRC_HAL_C4001_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include <driver/gpio.h>
#include <driver/uart.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Hardware configuration structure for C4001 UART module
 *
 * @param uartNum       UART port number (UART_NUM_0, UART_NUM_1, etc.)
 * @param baud          Baud rate in bits per second
 * @param txPin         GPIO pin number for UART transmit
 * @param rxPin         GPIO pin number for UART receive
 * @param rxBufSize     Receive buffer size in bytes
 * @param txBufSize     Transmit buffer size in bytes
 * @param queue         FreeRTOS queue handle for UART events
 */
typedef struct C4001Hw
{
    uart_port_t uartNum;

    uint32_t baud;

    gpio_num_t txPin;
    gpio_num_t rxPin;

    size_t rxBufSize;
    size_t txBufSize;

} C4001Hw;

/**
 * @brief Initialize C4001 UART hardware interface
 *
 * Configures the UART port with the specified baud rate, pins, and buffer sizes,
 * and enables UART event handling through the configured queue.
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool c4001_hal_init( C4001Hw * sensor );

/**
 * @brief De-initialize C4001 UART hardware interface
 *
 * Removes the UART driver and reset pins
 *
 * @param sensor Pointer to hardware configuration structure
 *
 * @return true  De-initialization successful
 * @return false De-initialization failed or invalid parameter
 */
bool c4001_hal_deinit( C4001Hw * sensor );
/**
 * @brief Write data to C4001 UART
 *
 * Transmits data bytes through the UART interface.
 *
 * @param sensor Pointer to hardware configuration structure
 * @param data   Pointer to data buffer to transmit
 * @param len    Number of bytes to write
 *
 * @return true  Write successful
 * @return false Write failed or invalid parameter
 */
bool c4001_hal_write( const C4001Hw * sensor,
                      const uint8_t * data,
                      size_t len );

/**
 * @brief Read data from C4001 UART
 *
 * Receives data bytes from the UART interface with an optional timeout.
 *
 * @param sensor      Pointer to hardware configuration structure
 * @param data        Pointer to output buffer for received data
 * @param maxLen      Maximum number of bytes to read
 * @param timeoutMs   Read timeout in milliseconds (0 for non-blocking)
 *
 * @return >=0 Number of bytes successfully read
 * @return -1  Read failed or invalid parameter
 */
int c4001_hal_read( const C4001Hw * sensor,
                    uint8_t * data,
                    size_t maxLen,
                    uint32_t timeoutMs );

size_t c4001_hal_available( const C4001Hw * sensor );

/**
 * @brief Flush the C4001 UART stream buffer
 * 
 * @param sensor      Pointer to hardware configuration structure
 * 
 * @return true  Flush successful
 * @return false Flush failed or invalid parameter
 */
bool c4001_hal_flush( const C4001Hw * sensor );

/**
 * @brief Delay execution for specified milliseconds
 *
 * @param delayMs Delay duration in milliseconds
 */
void c4001_hal_delay_ms( uint32_t delayMs );

/**
 * @brief Get time in microseconds since boot
 * 
 * @return Number of microseconds since the initialization of timer
 */
int64_t c4001_hal_timer_get_time_ms( void );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_C4001_H */
