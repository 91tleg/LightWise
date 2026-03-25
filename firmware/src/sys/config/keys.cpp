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

#include <cstddef>
#include <cstring>
#include <array>

#include <nvs.h>
#include <nvs_flash.h>

#include "types/lorawan_keys.hpp"
#include "utils/security/secure_zero.hpp"

namespace lorawan
{

    bool loadKeysFromNvs( Keys & keys ) noexcept
    {
        bool result { false };

        nvs_handle_t handle {};
        const esp_err_t openErr { nvs_open( "lwnode", NVS_READONLY, &handle ) };

        if( openErr == ESP_OK )
        {
            std::array< char, Keys::kAppKeyHexLen + 1U > appKey {};
            std::array< char, Keys::kAppEuiHexLen + 1U > appEui {};
            //char appKey[ Keys::kAppKeyHexLen + 1U ] {};
            size_t appKeySize { sizeof( appKey ) };

            const esp_err_t keyErr { nvs_get_str( handle,
                                                  "appkey",
                                                  appKey.data(),
                                                  &appKeySize ) };

            //char appEui[ Keys::kAppEuiHexLen + 1U ] {};
            size_t appEuiSize { sizeof( appEui ) };

            const esp_err_t euiErr { nvs_get_str( handle,
                                                  "appEui",
                                                  appEui.data(),
                                                  &appEuiSize ) };

            nvs_close( handle );

            if( ( keyErr == ESP_OK ) && ( euiErr == ESP_OK ) )
            {
                static_cast< void >( std::memcpy( keys.appKey.data(),
                                                  appKey.data(),
                                                  Keys::kAppKeyHexLen ) );
                keys.appKey[ Keys::kAppKeyHexLen ] = '\0';

                static_cast< void >( std::memcpy( keys.appEui.data(),
                                                  appEui.data(),
                                                  Keys::kAppEuiHexLen ) );
                keys.appEui[ Keys::kAppEuiHexLen ] = '\0';

                result = true;
            }

            /* Zero keys from stack regardless of success. */
            security::secureZero( appKey );
            security::secureZero( appEui );
        }

        return result;
    }

} /* namespace lorawan */
