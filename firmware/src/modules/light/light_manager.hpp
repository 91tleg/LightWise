#ifndef SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP
#define SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP

#include <cstdint>

namespace light
{

    class LightSensor;
    class LedPresence;

    class Manager
    {
    public:
        /**
         * @brief  Construct with injected LED driver.
         *
         * @param  led  Non-null reference to the LED driver (static lifetime).
         *
         * Post-condition: current_ = 0, not ramping, stepsPerSecond_ = 1
         * (safe minimum — caller must set a real rate via setTarget()).
         */
        explicit Manager( LightSensor & led, LedPresence & detect ) noexcept;

        ~Manager()                             = default;
        Manager( const Manager & )             = delete;
        Manager & operator=( const Manager & ) = delete;
        Manager( Manager && )                  = delete;
        Manager & operator=( Manager && )      = delete;

        /**
         * @brief  Set a new brightness target and ramp rate.
         *
         * @param  target         Desired output level [0, 100].
         * @param  stepsPerSecond Ramp speed in steps/s. Zero is clamped to 1.
         *                        Examples: 1 = slow fade, 255 = near-instant.
         */
        void setTarget( uint8_t target, uint8_t stepsPerSecond ) noexcept;

        /**
         * @brief  Advance the ramp by one step and apply to hardware.
         *
         * Call at the interval returned by stepIntervalMs().
         * On hardware write failure the step is rolled back and retried on
         * the next call — ramping_ is never cleared on a failed write.
         *
         * @return true  if the target has been reached (ramp complete).
         * @return false if still ramping or a hardware write failed.
         */
        [[nodiscard]] bool step() noexcept;

        /**
         * @brief  Query whether a ramp is in progress.
         * @return true if current_ != target_.
         */
        [[nodiscard]] bool isRamping() const noexcept;

        /**
         * @brief  Return the current target level.
         */
        [[nodiscard]] uint8_t getTarget() const noexcept;

        /**
         * @brief  Return the delay between step() calls in milliseconds.
         *
         * Derived from stepsPerSecond set in the last setTarget() call.
         */
        [[nodiscard]] uint32_t stepIntervalMs() const noexcept;

        [[nodiscard]] bool isPresent() const noexcept;

    private:
        LightSensor & led_;
        LedPresence & detect_;

        uint8_t  current_        { 0U };
        uint8_t  target_         { 0U };
        uint8_t  stepsPerSecond_ { 1U };
        bool     ramping_        { false };

        static constexpr uint32_t kMsPerSecond { 1000U };
        static constexpr uint8_t  kLevelMin    { 0U };
        static constexpr uint8_t  kLevelMax    { 100U };
    };

} /* namespace light */

#endif /* SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP */
