#ifndef SRC_LIB_LIGHT_RBD_HPP
#define SRC_LIB_LIGHT_RBD_HPP

#include <cstdint>

#include "light_sensor.hpp"

typedef struct RbdHw RbdHw;

namespace light
{

    class Rbd final : public LightSensor
    {
    public:
        /**
         * @brief  Construct with reference to HAL struct.
         *
         * @param  hw  Reference to a RbdHw struct.
         */
        constexpr explicit Rbd( const RbdHw & hw ) noexcept
            : hw_    { hw }
            , level_ { 0U }
        {

        }

        ~Rbd() override                = default;
        Rbd( const Rbd & )             = delete;
        Rbd & operator=( const Rbd & ) = delete;
        Rbd( Rbd && )                  = delete;
        Rbd & operator=( Rbd && )      = delete;

        [[nodiscard]] bool setLevel( uint8_t level ) noexcept override;
        [[nodiscard]] uint8_t getLevel() const noexcept override;

        static constexpr uint8_t  kMaxLevel         { 100U        };
        static constexpr uint32_t kTriggerPulseUs   { 100U        };
        static constexpr uint32_t kTimerResolutionHz{ 1'000'000U  };

    private:
        const RbdHw & hw_;
        uint8_t level_;

    };

} /* namespace light */

#endif /* SRC_LIB_LIGHT_RBD_HPP */
