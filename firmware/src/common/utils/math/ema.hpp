#ifndef SRC_COMMON_UTILS_MATH_EMA_HPP
#define SRC_COMMON_UTILS_MATH_EMA_HPP

#include <cstdint>      /* uint8_t            */
#include <type_traits>  /* std::is_arithmetic */

namespace filter
{
    inline constexpr float k_alphaMin     { 0.0f };
    inline constexpr float k_alphaMax     { 1.0f };
    inline constexpr float k_alphaDefault { 0.1f };

    /**
     * @brief  EMA filter parameterised on sample type T.
     *
     * @tparam T  Arithmetic scalar. Explicit instantiations: uint8_t, float.
     *
     * Every constructed object is immediately ready to accept samples.
     * Internal accumulation uses float to preserve precision for integer types.
     */
    template< typename T >
    class EMA
    {
        static_assert( std::is_arithmetic< T >::value,
                       "EMA<T>: T must be an arithmetic type." );

    public:
        /**
         * @brief  Construct with optional alpha.
         *
         * @param  alpha  Smoothing factor in (0, 1].
         *                Pass 0.0f (default) to use k_alphaDefault.
         *                Values outside [k_alphaMin, k_alphaMax] are clamped.
         *
         * Post-condition: object is fully configured; update() may be called
         * immediately — no separate initialisation step required or exists.
         */
        constexpr explicit EMA( float alpha = k_alphaDefault ) noexcept;

        ~EMA()                             = default;
        EMA( const EMA & )                 = default;
        EMA &operator=( const EMA & )      = default;
        EMA( EMA && )          noexcept    = default;
        EMA &operator=( EMA && ) noexcept  = default;

        /**
         * @brief  Feed one sample and obtain the current filtered value.
         *
         * Always succeeds on a properly constructed object.
         *
         * @param  input  Raw sample.
         * @param  out    Filled with the filtered result.
         * @return true (retained for [[nodiscard]] enforcement and API symmetry).
         */
        [[nodiscard]] bool update( T input, T &out ) noexcept;

        /**
         * @brief  Reset filter state.
         *         The next sample seeds the accumulator; alpha is preserved.
         * @return true.
         */
        [[nodiscard]] bool reset() noexcept;

        /**
         * @brief  Change the smoothing factor at runtime.
         *
         * @param  alpha  New factor in (0, 1]. Pass 0.0f to restore k_alphaDefault.
         * @return true.
         */
        [[nodiscard]] bool reconfigure( float alpha ) noexcept;

        /**
         * @brief  Read the current smoothing factor.
         * @return alpha in [k_alphaMin, k_alphaMax].
         */
        [[nodiscard]] float alpha() const noexcept;

    private:
        float value_  { 0.0f           };
        float alpha_  { k_alphaDefault };
        bool  isInit_ { false          };

        [[nodiscard]] static constexpr float clampAlpha( float alpha ) noexcept;
        [[nodiscard]] static constexpr float resolveAlpha( float alpha ) noexcept;
    };

    extern template class EMA< uint8_t >;
    extern template class EMA< float   >;

    template< typename T >
    constexpr EMA< T >::EMA( float alpha ) noexcept
        : value_  { 0.0f                  }
        , alpha_  { resolveAlpha( alpha ) }
        , isInit_ { false                 }
    {

    }

    template< typename T >
    constexpr float EMA< T >::clampAlpha( float alpha ) noexcept
    {
        float clamped { alpha };

        if( alpha < k_alphaMin )
        {
            clamped = k_alphaMin;
        }
        else if( alpha > k_alphaMax )
        {
            clamped = k_alphaMax;
        }
        else
        {
            /* alpha already in range. */
        }

        return clamped;
    }

    template< typename T >
    constexpr float EMA< T >::resolveAlpha( float alpha ) noexcept
    {
        return ( alpha == 0.0f ) ? k_alphaDefault : clampAlpha( alpha );
    }

} /* namespace filter */

#endif /* SRC_COMMON_UTILS_MATH_EMA_HPP */
