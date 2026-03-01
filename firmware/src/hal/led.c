#include "led.h"

#include <stddef.h>
#include <esp_err.h>

#define ADC_MAX_12BIT  ( 4095U )

bool led_hal_init( const LedHw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        /* Configure PWM timer */
        const ledc_timer_config_t timerCfg =
        {
            .speed_mode       = LEDC_LOW_SPEED_MODE,
            .timer_num        = hw->pwmTimer,
            .duty_resolution  = hw->pwmResolutionBits,
            .freq_hz          = hw->pwmFreqHz,
            .clk_cfg          = LEDC_AUTO_CLK,
        };

        esp_err_t err = ledc_timer_config( &timerCfg );

        if( err == ESP_OK )
        {
            /* Configure PWM channel */
            const ledc_channel_config_t channelCfg =
            {
                .gpio_num   = hw->pin,
                .speed_mode = LEDC_LOW_SPEED_MODE,
                .channel    = hw->pwmChannel,
                .timer_sel  = hw->pwmTimer,
                .duty       = 0U,
                .hpoint     = 0,
            };

            err = ledc_channel_config( &channelCfg );

            if( err == ESP_OK )
            {
                result = true;
            }
        }
    }

    return result;
}

bool led_hal_deinit( const LedHw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        /* Stop PWM output */
        const esp_err_t err = ledc_stop( LEDC_LOW_SPEED_MODE,
                                         hw->pwmChannel,
                                         0U );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool led_hal_set_level( const LedHw * const hw,
                        uint32_t adcValue )
{
    bool result = false;

    if( hw != NULL )
    {
        const uint32_t maxDuty =
            ( 1U << hw->pwmResolutionBits ) - 1U;

        uint32_t duty = ( adcValue * maxDuty ) / ADC_MAX_12BIT;

        const esp_err_t err = ledc_set_duty( LEDC_LOW_SPEED_MODE,
                                             hw->pwmChannel,
                                             duty );

        if( err == ESP_OK )
        {
            if( ledc_update_duty( LEDC_LOW_SPEED_MODE,
                                  hw->pwmChannel ) == ESP_OK )
            {
                result = true;
            }
        }
    }

    return result;
}
