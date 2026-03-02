#ifndef SRC_LIB_LIGHT_LED_HPP
#define SRC_LIB_LIGHT_LED_HPP

#include <cstdint>
#include "light_sensor.hpp"

typedef struct LedHw LedHw;

namespace light 
{
    /**
     * @class Led
     * @brief Concrete LED implementation of the LightSensor interface.
     * 
     * Controls an LED's brightness by setting PWM duty cycles. Manages
     * LED initialization and tracks the current brightness level.
     */
    class Led final : public LightSensor
    {
    public:
        /**
         * @brief Constructs an Led instance.
         * 
         * @param sensor Pointer to hardware configuration for the LED.
         */
        explicit constexpr Led( const LedHw * sensor )
            : sensor_( sensor ), 
              level_( 0U ), 
              isInitialized_( false )
        {

        }

        /**
         * @brief Initializes the LED hardware.
         * 
         * @return true if initialization succeeds, false otherwise.
         */
        bool init();

        /**
         * @brief Sets the LED brightness level.
         * 
         * @param level Brightness level as percentage [0–100].
         * @return true if the level was set successfully, false otherwise.
         * 
         * @override
         */
        bool setLevel( uint8_t level ) override;

        /**
         * @brief Gets the last set LED brightness level.
         * 
         * @param level Reference to store the brightness level [0–100].
         * @return true if the level was retrieved successfully, false otherwise.
         * 
         * @override
         */
        bool getLevel( uint8_t & level ) const override;

    private:
        static constexpr uint8_t kMinLevel = 0U; /**< Minimum brightness level (percent). */
        static constexpr uint8_t kMaxLevel = 100U; /**< Maximum brightness level (percent). */

        /**
         * @brief Converts a brightness percentage to PWM duty cycle.
         * 
         * @param level Brightness level [0–100].
         * @return The corresponding PWM duty cycle value.
         */
        static uint32_t levelToPwmDuty( uint8_t level );

    private:
        const LedHw * sensor_; /**< Pointer to LED hardware configuration. */
        uint8_t level_;        /**< Current brightness level [0–100]. */
        bool isInitialized_;   /**< Device initialization flag. */
    };
} /* namespace light */

#endif /* SRC_LIB_LIGHT_LED_HPP */
