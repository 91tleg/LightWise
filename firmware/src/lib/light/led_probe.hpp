#ifndef SRC_LIB_LIGHT_LED_PROBE_HPP
#define SRC_LIB_LIGHT_LED_PROBE_HPP

#include "led_presence.hpp"

typedef struct LedDetect LedDetect;

namespace light
{
    /**
     * @class LedProbe
     * @brief Concrete LED presence detection implementation of the LedPresence interface.
     *
     * Detects whether an LED is physically connected by reading a GPIO pin
     * configured with an internal pull-up resistor.
     */
    class LedProbe final : public LedPresence
    {
    public:
        /**
         * @brief Constructs a LedProbe instance.
         *
         * @param detect Reference to the HAL LED detect configuration.
         */
        explicit constexpr LedProbe( LedDetect & detect ) noexcept
            : detect_ { detect }
        {
    
        }

        /**
         * @brief Checks whether the LED is physically present.
         *
         * @return true  LED connected.
         * @return false LED absent or HAL fault.
         */
        [[nodiscard]] bool isPresent() const noexcept override;

    private:
        LedDetect & detect_; /**< Reference to LED detect HAL configuration. */
    };

} /* namespace light */

#endif /* SRC_LIB_LIGHT_LED_PROBE_HPP */
