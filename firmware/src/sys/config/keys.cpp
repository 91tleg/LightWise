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
#include "utils/nvs/nvs_utils.hpp"

namespace lorawan
{

    bool loadKeysFromNvs( Keys & keys ) noexcept
    {
        bool ok { false };
        nvs::Handle handle { "lwnode", NVS_READONLY };
        if( handle.ok() )
        {

            std::array< char, Keys::kAppKeyHexLen + 1U > appKey {};
            std::array< char, Keys::kAppEuiHexLen + 1U > appEui {};

            size_t appKeySize { appKey.size() };
            size_t appEuiSize { appEui.size() };

            ok = handle.readStr( "appkey", appKey.data(), appKeySize ) &&
                 handle.readStr( "appEui", appEui.data(), appEuiSize );

            if( ok )
            {
                static_cast< void >( std::memcpy( keys.appKey.data(),
                                                  appKey.data(),
                                                  Keys::kAppKeyHexLen ) );
                keys.appKey[ Keys::kAppKeyHexLen ] = '\0';

                static_cast< void >( std::memcpy( keys.appEui.data(),
                                                  appEui.data(),
                                                  Keys::kAppEuiHexLen ) );
                keys.appEui[ Keys::kAppEuiHexLen ] = '\0';
            }

            security::secureZero( appKey );
            security::secureZero( appEui );
        }

        return ok;
    }

} /* namespace lorawan */
