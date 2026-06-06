#ifndef SRC_LIB_LIGHT_LED_PRESENCE_HPP
#define SRC_LIB_LIGHT_LED_PRESENCE_HPP

namespace light
{
    /**
     * @brief Pure virtual interface for LED presence detection.
     */
    class LedPresence
    {
    public:
        virtual ~LedPresence() = default;

        /**
         * @brief Check whether the LED is physically present.
         *
         * @return true   LED connected
         * @return false  LED absent or HAL fault
         */
        [[nodiscard]] virtual bool isPresent() const noexcept = 0;

    protected:
        LedPresence()                                   = default;
        LedPresence( const LedPresence & )              = default;
        LedPresence & operator=( const LedPresence & )  = default;
        LedPresence( LedPresence && )                   = default;
        LedPresence & operator=( LedPresence && )       = default;
    };

} /* namespace light */

#endif /* SRC_LIB_LIGHT_LED_PRESENCE_HPP */
