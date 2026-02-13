#ifndef SRC_BOARD_BOARD_H
#define SRC_BOARD_BOARD_H  

#include <stddef.h>
#include <stdint.h>

#include <driver/gpio.h>
#include <driver/i2c_master.h>
#include <driver/uart.h>
#include <esp_adc/adc_oneshot.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Centralized hardware configuration for the board.
 */
typedef struct Board
{
    adc_unit_t alsPt19PrimaryUnit;
    adc_channel_t alsPt19PrimaryChannel;

    adc_unit_t alsPt19SecondaryUnit;
    adc_channel_t alsPt19SecondaryChannel;

    gpio_num_t dht11PrimaryPin;
    gpio_num_t dht11SecondaryPin;

    uart_port_t c4001PrimaryUartNum;
    gpio_num_t c4001PrimaryTxPin;
    gpio_num_t c4001PrimaryRxPin;
    uint32_t c4001PrimaryBaud;
    uint16_t c4001PrimaryRxBufSize;
    uint16_t c4001PrimaryTxBufSize;

    uart_port_t c4001SecondaryUartNum;
    gpio_num_t c4001SecondaryTxPin;
    gpio_num_t c4001SecondaryRxPin;
    uint32_t c4001SecondaryBaud;
    size_t c4001SecondaryRxBufSize;
    size_t c4001SecondaryTxBufSize;

    i2c_port_t lwnodeI2cPort;
    gpio_num_t lwnodeI2cSda;
    gpio_num_t lwnodeI2cScl;
    uint16_t lwnodeI2cAddr;
    gpio_num_t dimmerOutPin;
    gpio_num_t dimmerZcPin;
} Board;

/**
 * @brief Get the singleton board hardware configuration.
 *
 * @return const Board* Pointer to board config
 */
const Board * board_get( void );

#ifdef __cplusplus
}
#endif

#endif /* SRC_BOARD_BOARD_H */
