#include "nvs_utils.hpp"
#include <nvs.h>

namespace nvs
{
    Handle::Handle( const char * ns, nvs_open_mode_t mode ) noexcept
    {
        if( ns != nullptr )
        {
            ok_ = ( nvs_open( ns, mode, &handle_ ) == ESP_OK );
        }
    }

    Handle::~Handle() noexcept
    {
        if( ok_ )
        {
            nvs_close( handle_ );
        }
    }

    bool Handle::readU8( const char * key, uint8_t & out ) const noexcept
    {
        bool success { false };

        if( ok_ && ( key != nullptr ) )
        {
            success = ( nvs_get_u8( handle_, key, &out ) == ESP_OK );
        }

        return success;
    }

    bool Handle::readU16( const char * key, uint16_t & out ) const noexcept
    {
        bool success { false };

        if( ok_ && ( key != nullptr ) )
        {
            success = ( nvs_get_u16( handle_, key, &out ) == ESP_OK );
        }

        return success;
    }

    bool Handle::readStr( const char * key, char * out, size_t & len ) const noexcept
    {
        bool success { false };

        if( ok_ && ( key != nullptr ) )
        {
            success = ( nvs_get_str( handle_, key, out, &len ) == ESP_OK );
        }

        return success;
    }

    bool Handle::writeU8( const char * key, uint8_t val ) const noexcept
    {
        bool success { false };

        if( ok_ && ( key != nullptr ) )
        {
            success = ( nvs_set_u8( handle_, key, val ) == ESP_OK );
        }

        return success; 
    }

    bool Handle::writeU16( const char * key, uint16_t val ) const noexcept
    {
        bool success { false };

        if( ok_ && ( key != nullptr ) )
        {
            success = ( nvs_set_u16( handle_, key, val ) == ESP_OK );
        }

        return success;
    }

    bool Handle::commit() const noexcept
    {
        return ok_ && ( nvs_commit( handle_ ) == ESP_OK );
    }

} /* namespace nvs */
