/**
 * @file  src/sys/config/keys.cpp
 * @brief LoRaWAN key loading from NVS.
 *
 * @section Security notes
 *  - Stack buffers holding key material are explicitly zeroed before
 *    return to minimise window of exposure in RAM.
 *  - Keys are loaded into lorawan::Keys and returned to the caller.
 */

#include "keys.hpp"

#include <cstring>

#include <nvs.h>
#include <nvs_flash.h>

#include "types/lorawan_keys.hpp"

namespace lorawan
{

    namespace
    {

        /**
         * @brief  Zero a buffer in a way the compiler cannot optimise away.
         *         memset can be elided if the buffer is not read afterwards.
         *         volatile write prevents that.
         */
        void secureZero( void * const buf, size_t len ) noexcept
        {
            volatile auto * p { static_cast< volatile uint8_t * >( buf ) };
            while( len > 0U )
            {
                *p = 0U;
                ++p;
                --len;
            }
        }

    } /* anonymous namespace */

    bool loadKeysFromNvs( Keys & keys ) noexcept
    {
        bool result { false };

        nvs_handle_t handle {};
        const esp_err_t openErr { nvs_open( "lwnode", NVS_READONLY, &handle ) };

        if( openErr == ESP_OK )
        {
            char appKey[ Keys::kAppKeyHexLen + 1U ] {};
            size_t appKeySize { sizeof( appKey ) };

            const esp_err_t keyErr { nvs_get_str( handle,
                                                  "appkey",
                                                  appKey,
                                                  &appKeySize ) };

            char appEui[ Keys::kAppEuiHexLen + 1U ] {};
            size_t appEuiSize { sizeof( appEui ) };

            const esp_err_t euiErr { nvs_get_str( handle,
                                                  "appEui",
                                                  appEui,
                                                  &appEuiSize ) };

            nvs_close( handle );

            if( ( keyErr == ESP_OK ) && ( euiErr == ESP_OK ) )
            {
                static_cast< void >( std::memcpy( keys.appKey.data(),
                                                  appKey,
                                                  Keys::kAppKeyHexLen ) );
                keys.appKey[ Keys::kAppKeyHexLen ] = '\0';

                static_cast< void >( std::memcpy( keys.appEui.data(),
                                                  appEui,
                                                  Keys::kAppEuiHexLen ) );
                keys.appEui[ Keys::kAppEuiHexLen ] = '\0';

                result = true;
            }

            /* Zero keys from stack regardless of success. */
            secureZero( appKey, sizeof( appKey ) );
            secureZero( appEui, sizeof( appEui ) );
        }

        return result;
    }

} /* namespace lorawan */
