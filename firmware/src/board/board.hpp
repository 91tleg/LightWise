#ifndef SRC_BOARD_BOARD_HPP
#define SRC_BOARD_BOARD_HPP

#include <cstddef>
#include <cstdint>

#include <driver/gpio.h>
#include <driver/i2c_master.h>
#include <driver/uart.h>
#include <esp_adc/adc_oneshot.h>
#include <driver/ledc.h>

namespace board
{

    /**
     * @brief Centralized hardware configuration for the board.
     */
    struct Board
    {
        /* ADC units */
        adc_unit_t adcUnit1;

        /* ALS PT19 — both on ADC1 */
        adc_channel_t alsPt19PrimaryChannel;
        adc_channel_t alsPt19SecondaryChannel;

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

        i2c_port_t i2cPort;
        gpio_num_t i2cSda;
        gpio_num_t i2cScl;

        uint16_t lwnodeI2cAddr;
        uint16_t aht20I2cAddr;

        gpio_num_t        ledPwmPin;
        ledc_channel_t    ledPwmChannel;
        ledc_timer_t      ledPwmTimer;
        ledc_mode_t       ledPwmSpeedMode;
        uint32_t          ledPwmFreqHz;
        ledc_timer_bit_t  ledPwmDutyRes;

        gpio_num_t ledDetectPin;
    };

    inline constexpr Board config =
    {
        /* ALS PT19 ADC sensors (ADC1) */
        .adcUnit1 = ADC_UNIT_1,
        .alsPt19PrimaryChannel = ADC_CHANNEL_3,   /* GPIO4 */
        .alsPt19SecondaryChannel = ADC_CHANNEL_6, /* GPIO7 */

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

        /* I2C Bus */
        .i2cPort = I2C_NUM_0,
        .i2cSda  = GPIO_NUM_8,
        .i2cScl  = GPIO_NUM_9,

        /* LwNode */
        .lwnodeI2cAddr = 0x20U,

        /* AHT20 */
        .aht20I2cAddr = 0x38U,

        /* LED (PWM) for prototype */
        .ledPwmPin       = GPIO_NUM_2,
        .ledPwmChannel   = LEDC_CHANNEL_0,
        .ledPwmTimer     = LEDC_TIMER_0,
        .ledPwmSpeedMode = LEDC_LOW_SPEED_MODE,
        .ledPwmFreqHz    = 5000U,
        .ledPwmDutyRes   = LEDC_TIMER_12_BIT,

        .ledDetectPin    = GPIO_NUM_5,
    };

} /* namespace board */

#endif /* SRC_BOARD_BOARD_HPP */
