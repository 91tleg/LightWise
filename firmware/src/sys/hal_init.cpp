#include "hal_init.hpp"

#include "hal/adc_units.h"
#include "board/board.hpp"
#include "utils/log/log.h"

namespace hal
{

    namespace
    {

        constexpr char kTag[] { "HalInit" };

    }/* anonymous namespace */

    static constinit AdcUnit xAdcUnit1 { .unit   = board::config.adcUnit1,
                                         .handle = nullptr };

    constinit AlsPt19Hw xAlspt19Primary { .channel = board::config.alsPt19PrimaryChannel,
                                          .handle = nullptr };

    constinit AlsPt19Hw xAlspt19Secondary { .channel = board::config.alsPt19SecondaryChannel,
                                            .handle = nullptr };

    constinit C4001Hw xC4001Primary { .uartNum = board::config.c4001PrimaryUartNum,
                                      .baud = board::config.c4001PrimaryBaud,
                                      .txPin = board::config.c4001PrimaryTxPin,
                                      .rxPin = board::config.c4001PrimaryRxPin,
                                      .rxBufSize = board::config.c4001PrimaryRxBufSize,
                                      .txBufSize = board::config.c4001PrimaryTxBufSize };

    constinit C4001Hw xC4001Secondary { .uartNum = board::config.c4001SecondaryUartNum,
                                        .baud = board::config.c4001SecondaryBaud,
                                        .txPin = board::config.c4001SecondaryTxPin,
                                        .rxPin = board::config.c4001SecondaryRxPin,
                                        .rxBufSize = board::config.c4001SecondaryRxBufSize,
                                        .txBufSize = board::config.c4001SecondaryTxBufSize };

    constinit Dht11Hw xDht11Primary { .pin = board::config.dht11PrimaryPin };

    constinit LedHw xLed { .pin = board::config.ledPwmPin,
                           .pwmChannel = board::config.ledPwmChannel,
                           .pwmTimer = board::config.ledPwmTimer,
                           .pwmFreqHz = board::config.ledPwmFreqHz,
                           .pwmResolutionBits = board::config.ledPwmDutyRes };

    constinit LwnodeHw xLwnodePrimary { .port = board::config.lwnodeI2cPort,
                                        .sclPin = board::config.lwnodeI2cScl,
                                        .sdaPin = board::config.lwnodeI2cSda,
                                        .i2cAddr = board::config.lwnodeI2cAddr,
                                        .busHandle = nullptr,
                                        .devHandle = nullptr, };

    void init()
    {
        if( !adc_unit_init( &xAdcUnit1 ) )
        {
            LOGE( kTag, "ADC unit 1 init failed" );
        }

        if( !alspt19_hal_init( &xAlspt19Primary, xAdcUnit1.handle ) )
        {
            LOGE( kTag, "AlsPt19 primary init failed" );
        }

        if( !alspt19_hal_init( &xAlspt19Secondary, xAdcUnit1.handle ) )
        {
            LOGE( kTag, "AlsPt19 secondary init failed" );
        }

        if( !c4001_hal_init( &xC4001Primary ) )
        {
            LOGE( kTag, "C4001 primary init failed" );
        }

        if( !c4001_hal_init( &xC4001Secondary ) )
        {
            LOGE( kTag, "C4001 secondary init failed" );
        }

        if( !dht11_hal_init( &xDht11Primary ) )
        {
            LOGE( kTag, "Dht11 primary init failed" );
        }

        if( !led_hal_init( &xLed ) )
        {
            LOGE( kTag, "Led primary init failed" );
        }

        if( !lwnode_hal_init( &xLwnodePrimary ) )
        {
            LOGW( kTag, "Lwnode primary init failed" );
        }
    }

} /* namespace hal */
