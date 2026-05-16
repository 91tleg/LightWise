#include "hal_init.hpp"

#include "hal/adc_units.h"
#include "hal/i2c_bus.h"
#include "board/board.hpp"
#include "utils/log/log.h"

namespace hal
{

    namespace
    {

        constexpr char kTag[] { "HalInit" };

        constinit AdcUnit sAdcUnit1 { .unit   = board::config.adcUnit1,
                                      .handle = nullptr };

        constinit I2cBus sI2cBus { .port   = board::config.i2cPort,
                                   .scl    = board::config.i2cScl,
                                   .sda    = board::config.i2cSda,
                                   .handle = nullptr };
    }/* anonymous namespace */

    constinit AlsPt19Hw alspt19Primary { .channel = board::config.alsPt19PrimaryChannel,
                                         .handle  = nullptr };

    constinit AlsPt19Hw alspt19Secondary { .channel = board::config.alsPt19SecondaryChannel,
                                           .handle  = nullptr };

    constinit C4001Hw c4001Primary { .uartNum   = board::config.c4001PrimaryUartNum,
                                     .baud      = board::config.c4001PrimaryBaud,
                                     .txPin     = board::config.c4001PrimaryTxPin,
                                     .rxPin     = board::config.c4001PrimaryRxPin,
                                     .rxBufSize = board::config.c4001PrimaryRxBufSize,
                                     .txBufSize = board::config.c4001PrimaryTxBufSize };

    constinit C4001Hw c4001Secondary { .uartNum   = board::config.c4001SecondaryUartNum,
                                       .baud      = board::config.c4001SecondaryBaud,
                                       .txPin     = board::config.c4001SecondaryTxPin,
                                       .rxPin     = board::config.c4001SecondaryRxPin,
                                       .rxBufSize = board::config.c4001SecondaryRxBufSize,
                                       .txBufSize = board::config.c4001SecondaryTxBufSize };

    constinit Aht20Hw aht20Primary { .bus    = &sI2cBus,
                                     .addr   = board::config.aht20I2cAddr,
                                     .handle = nullptr };

    constinit LedHw led { .pin               = board::config.ledPwmPin,
                          .pwmChannel        = board::config.ledPwmChannel,
                          .pwmTimer          = board::config.ledPwmTimer,
                          .pwmFreqHz         = board::config.ledPwmFreqHz,
                          .pwmResolutionBits = board::config.ledPwmDutyRes };

    constinit LwnodeHw lwnodePrimary { .bus    = &sI2cBus,
                                       .addr   = board::config.lwnodeI2cAddr,
                                       .handle = nullptr };

    void init()
    {
        if( !adc_unit_init( &sAdcUnit1 ) )
        {
            LOGE( kTag, "ADC unit 1 init failed" );
        }

        if( !alspt19_hal_init( &alspt19Primary, sAdcUnit1.handle ) )
        {
            LOGE( kTag, "AlsPt19 primary init failed" );
        }

        if( !alspt19_hal_init( &alspt19Secondary, sAdcUnit1.handle ) )
        {
            LOGE( kTag, "AlsPt19 secondary init failed" );
        }

        if( !c4001_hal_init( &c4001Primary ) )
        {
            LOGE( kTag, "C4001 primary init failed" );
        }

        if( !c4001_hal_init( &c4001Secondary ) )
        {
            LOGE( kTag, "C4001 secondary init failed" );
        }

        if( !led_hal_init( &led ) )
        {
            LOGE( kTag, "Led primary init failed" );
        }

        if( !i2c_bus_init( &sI2cBus ) )
        {
            LOGE( kTag, "I2c bus init failed" );
        }

        if( !lwnode_hal_init( &lwnodePrimary, &sI2cBus ) )
        {
            LOGE( kTag, "Lwnode primary init failed" );
        }

        if( !aht20_hal_init( &aht20Primary, &sI2cBus ) )
        {
            LOGE( kTag, "AHT20 init failed" );
        }
    }

} /* namespace hal */
