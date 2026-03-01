#ifndef SRC_HAL_LED_H
#define SRC_HAL_LED_H

#include <stdint.h>
#include <stdbool.h>

#include <driver/gpio.h>
#include <driver/ledc.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @struct LedHw
 * @brief Hardware configuration for an LED.
 * 
 * Contains the GPIO pin and PWM configuration required to control
 * an LED with adjustable brightness via hardware PWM.
 */
typedef struct LedHw
{
    
    gpio_num_t pin;  /**< GPIO pin number used for LED control. */
    ledc_channel_t pwmChannel;  /**< LEDC PWM channel for brightness control. */
    ledc_timer_t pwmTimer;  /**< LEDC PWM timer used by the channel. */
    uint32_t pwmFreqHz;  /**< PWM frequency in Hz. */
    uint32_t pwmResolutionBits;  /**< PWM resolution in bits */
} LedHw;

/**
 * @brief Initializes the LED hardware.
 * 
 * Configures the GPIO pin and PWM settings according to the provided
 * hardware configuration. Must be called before using other LED functions.
 * 
 * @param hw Pointer to LedHw structure containing hardware configuration.
 * @return true if initialization succeeds, false otherwise.
 */
bool led_hal_init( const LedHw * hw );

/**
 * @brief Deinitializes the LED hardware.
 * 
 * Releases GPIO and PWM resources associated with the LED. Should be called
 * when the LED is no longer needed.
 * 
 * @param hw Pointer to LedHw structure for the LED to deinitialize.
 * @return true if deinitialization succeeds, false otherwise.
 */
bool led_hal_deinit( const LedHw * hw );

/**
 * @brief Sets the LED brightness level.
 * 
 * Controls the LED brightness by adjusting the PWM duty cycle. The brightness
 * is adjusted based on the ADC value provided, allowing analog-to-PWM conversion.
 * 
 * @param hw Pointer to LedHw structure for the LED to control.
 * @param adcValue ADC value representing desired brightness level.
 * @return true if the brightness was set successfully, false otherwise.
 */
bool led_hal_set_level( const LedHw * hw,
                        uint32_t adcValue );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_LED_H */
