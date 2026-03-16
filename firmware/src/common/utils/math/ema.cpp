/**
 * @file  src/common/utils/math/ema.cpp
 * @brief EMA<T> method definitions + explicit instantiations.
 *
 * Standards compliance: MISRA C++:2023 / DO-332 / DO-178C / ESP-IDF.
 * See ema.hpp for full rationale and rule index.
 */

#include "ema.hpp"

namespace filter
{

    template< typename T >
    bool EMA< T >::update( T input, T &out ) noexcept
    {
        if( isInit_ )
        {
            /* EMA: value += alpha * (input - value) */
            const float inputF { static_cast< float >( input ) };
            value_ = value_ + ( alpha_ * ( inputF - value_ ) );
        }
        else
        {
            /* First sample seeds the accumulator. */
            value_  = static_cast< float >( input );
            isInit_ = true;
        }

        out = static_cast< T >( value_ );
        return true;
    }

    template< typename T >
    bool EMA< T >::reset() noexcept
    {
        isInit_ = false;
        return true;
    }

    template< typename T >
    bool EMA< T >::reconfigure( float alpha ) noexcept
    {
        alpha_ = resolveAlpha( alpha );
        return true;
    }

    template< typename T >
    float EMA< T >::alpha() const noexcept
    {
        return alpha_;
    }

    template class EMA< uint8_t >;
    template class EMA< float   >;

} /* namespace filter */
