/* utils/nvs/nvs_utils.hpp */
#ifndef SRC_COMMON_UTILS_NVS_NVS_UTILS_HPP
#define SRC_COMMON_UTILS_NVS_NVS_UTILS_HPP

#include <cstdint>
#include <nvs.h>

namespace nvs
{
    /**
     * @brief RAII NVS handle
     */
    class Handle
    {
    public:
        Handle( const char * ns, nvs_open_mode_t mode ) noexcept;
        ~Handle() noexcept;

        Handle( const Handle & )             = delete;
        Handle & operator=( const Handle & ) = delete;

        [[nodiscard]] bool ok() const noexcept
        {
            return ok_;
        }

        [[nodiscard]] nvs_handle_t get() const noexcept
        {
            return handle_;
        }

        [[nodiscard]] bool readU8 ( const char * key, uint8_t & out ) const noexcept;
        [[nodiscard]] bool readU16( const char * key, uint16_t & out ) const noexcept;
        [[nodiscard]] bool readStr( const char * key, char * out, size_t & len ) const noexcept;

        [[nodiscard]] bool writeU8 ( const char * key, uint8_t val ) const noexcept;
        [[nodiscard]] bool writeU16( const char * key, uint16_t val ) const noexcept;

        [[nodiscard]] bool commit() const noexcept;

    private:
        nvs_handle_t handle_ {};
        bool ok_ { false };
    };

} /* namespace nvs */

#endif /* SRC_COMMON_UTILS_NVS_NVS_UTILS_HPP */
