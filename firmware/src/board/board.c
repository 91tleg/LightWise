#include "board.h"

static const Board board =
{
    /* ALS PT19 ADC sensors (ADC1) */
    .alsPt19PrimaryUnit     = ADC_UNIT_1,
    .alsPt19PrimaryChannel = ADC_CHANNEL_4,   /* GPIO6 */

    .alsPt19SecondaryUnit     = ADC_UNIT_1,
    .alsPt19SecondaryChannel = ADC_CHANNEL_5, /* GPIO7 */

    /* DHT11 Sensors */
    .dht11PrimaryPin   = GPIO_NUM_10,
    .dht11SecondaryPin = GPIO_NUM_11,

    /* C4001 Radar Sensor - Primary (UART1) */
    .c4001PrimaryUartNum   = UART_NUM_1,
    .c4001PrimaryTxPin    = GPIO_NUM_17,
    .c4001PrimaryRxPin    = GPIO_NUM_18,
    .c4001PrimaryBaud     = 115200U,
    .c4001PrimaryRxBufSize = 1024U,
    .c4001PrimaryTxBufSize = 1024U,

    /* C4001 Radar Sensor - Secondary (UART2) */
    .c4001SecondaryUartNum   = UART_NUM_2,
    .c4001SecondaryTxPin    = GPIO_NUM_15,
    .c4001SecondaryRxPin    = GPIO_NUM_16,
    .c4001SecondaryBaud     = 115200U,
    .c4001SecondaryRxBufSize = 1024U,
    .c4001SecondaryTxBufSize = 1024U,

    /* LwNode (I2C Bus) */
    .lwnodeI2cPort = I2C_NUM_0,
    .lwnodeI2cSda  = GPIO_NUM_8,
    .lwnodeI2cScl  = GPIO_NUM_9,
    .lwnodeI2cAddr = 0x20U,

    /* AC Light Dimmer */
    .dimmerOutPin = GPIO_NUM_12,
    .dimmerZcPin  = GPIO_NUM_13
};

const Board * board_get( void )
{
    return &board;
}
