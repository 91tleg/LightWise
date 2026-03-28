#ifndef SRC_COMMON_UTILS_SECURITY_SECURE_ZERO_HPP
#define SRC_COMMON_UTILS_SECURITY_SECURE_ZERO_HPP

#include <cstdint>
#include <cstddef>
#include <span>

namespace security
{

    /**
     * @brief Securely zero a memory buffer.
     *
     * Uses a volatile pointer to prevent the compiler from optimizing
     * away the zeroing operation.
     *
     * @param buf  Pointer to buffer to zero. Must not be null.
     * @param len  Number of bytes to zero.
     */
    inline void secureZero( std::span< std::byte > buf ) noexcept
    {
        volatile std::byte * p { buf.data() };
        const size_t len { buf.size() };

        for( size_t i { 0U }; i < len; ++i )
        {
            p[ i ] = std::byte { 0U };
        }
    }

    template< typename T >
    inline void secureZero( T & obj ) noexcept
    {
        volatile std::byte * p { reinterpret_cast< std::byte * >( &obj ) };
        for( size_t i { 0U }; i < sizeof( T ); ++i )
        {
            p[ i ] = std::byte { 0U };
        }
    }

} /* namespace security */

#endif /* SRC_COMMON_UTILS_SECURITY_SECURE_ZERO_HPP */
