#ifndef SRC_COMMON_UTILS_MATH_FAULT_COUNTER_HPP
#define SRC_COMMON_UTILS_MATH_FAULT_COUNTER_HPP

#include <cstdint>

namespace filter
{

/* Debounced fault detector with hysteresis: counts up on bad, down on good. */
class FaultCounter
{
public:
    constexpr FaultCounter( uint8_t limit, uint8_t max ) noexcept
        : limit_ { limit }, max_ { max } {}

    void record( bool bad ) noexcept
    {
        if( bad )
        {
            if( count_ < max_ ) { ++count_; }
        }
        else
        {
            if( count_ > 0U ) { --count_; }
        }
    }

    bool    tripped() const noexcept { return count_ >= limit_; }
    uint8_t count()   const noexcept { return count_; }
    void    reset()         noexcept { count_ = 0U; }

private:
    uint8_t limit_;
    uint8_t max_;
    uint8_t count_ { 0U };
};

} /* namespace filter */

#endif /* SRC_COMMON_UTILS_MATH_FAULT_COUNTER_HPP */
