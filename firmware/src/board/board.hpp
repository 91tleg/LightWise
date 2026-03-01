#ifndef SRC_BOARD_BOARD_HPP
#define SRC_BOARD_BOARD_HPP

#include <stddef.h>
#include <stdint.h>

#include <driver/gpio.h>
#include <driver/i2c_master.h>
#include <driver/uart.h>
#include <esp_adc/adc_oneshot.h>

namespace board
{
    /**
     * @brief Centralized hardware configuration for the board.
     */
    struct Board
    {
        adc_unit_t alsPt19PrimaryUnit;
        adc_channel_t alsPt19PrimaryChannel;

        adc_unit_t alsPt19SecondaryUnit;
        adc_channel_t alsPt19SecondaryChannel;

        gpio_num_t dht11PrimaryPin;

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

        gpio_num_t        ledPwmPin;
        ledc_channel_t    ledPwmChannel;
        ledc_timer_t      ledPwmTimer;
        ledc_mode_t       ledPwmSpeedMode;
        uint32_t          ledPwmFreqHz;
        ledc_timer_bit_t  ledPwmDutyRes;
    };

    inline constexpr Board config =
    {
        /* ALS PT19 ADC sensors (ADC1) */
        .alsPt19PrimaryUnit    = ADC_UNIT_1,
        .alsPt19PrimaryChannel = ADC_CHANNEL_4,   /* GPIO6 */

        .alsPt19SecondaryUnit    = ADC_UNIT_2,
        .alsPt19SecondaryChannel = ADC_CHANNEL_0, /* GPIO11 */

        /* DHT11 Sensors */
        .dht11PrimaryPin   = GPIO_NUM_5,

        /* C4001 Radar Sensor - Primary (UART1) */
        .c4001PrimaryUartNum   = UART_NUM_1,
        .c4001PrimaryTxPin     = GPIO_NUM_17,
        .c4001PrimaryRxPin     = GPIO_NUM_18,
        .c4001PrimaryBaud      = 9600U,
        .c4001PrimaryRxBufSize = 1024U,
        .c4001PrimaryTxBufSize = 1024U,

        /* C4001 Radar Sensor - Secondary (UART2) */
        .c4001SecondaryUartNum   = UART_NUM_2,
        .c4001SecondaryTxPin     = GPIO_NUM_15,
        .c4001SecondaryRxPin     = GPIO_NUM_16,
        .c4001SecondaryBaud      = 9600U,
        .c4001SecondaryRxBufSize = 1024U,
        .c4001SecondaryTxBufSize = 1024U,

        /* LwNode (I2C Bus) */
        .lwnodeI2cPort = I2C_NUM_0,
        .lwnodeI2cSda  = GPIO_NUM_8,
        .lwnodeI2cScl  = GPIO_NUM_9,
        .lwnodeI2cAddr = 0x20U,

        /* AC Light Dimmer */
        .dimmerOutPin = GPIO_NUM_14,
        .dimmerZcPin  = GPIO_NUM_13,

        /* LED (PWM) for prototype */
        .ledPwmPin       = GPIO_NUM_2,
        .ledPwmChannel   = LEDC_CHANNEL_0,
        .ledPwmTimer     = LEDC_TIMER_0,
        .ledPwmSpeedMode = LEDC_LOW_SPEED_MODE,
        .ledPwmFreqHz    = 5000U,
        .ledPwmDutyRes   = LEDC_TIMER_12_BIT
    };
} /* namespace board */

#endif /* SRC_BOARD_BOARD_HPP */
