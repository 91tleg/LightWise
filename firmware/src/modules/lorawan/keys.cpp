#include "keys.hpp"

#include <nvs_flash.h>
#include <nvs.h>

#include "lib/lorawan/lorawan_sensor.hpp"

namespace lorawan
{
    bool load_keys_from_nvs( LorawanSensor & device )
    {
        bool result = false;

        nvs_handle_t handle;
        esp_err_t err = nvs_open( "lwnode",
                                  NVS_READWRITE,
                                  &handle );
        if( err == ESP_OK )
        {
            /* Load AppKey */
            char appKey[ LorawanSensor::kAppKeyHexChars + 1U ]{};
            size_t appKeySize = sizeof( appKey );
            err = nvs_get_str( handle,
                               "appkey",
                               appKey,
                               &appKeySize );
            if( err == ESP_OK )
            {
                device.setAppKey( appKey );

                /* Load AppEui */
                char appEui[ LorawanSensor::kAppEuiHexChars + 1U ]{};
                size_t appEuiSize = sizeof( appEui );
                err = nvs_get_str( handle,
                                   "appEui",
                                   appEui,
                                   &appEuiSize );
                if (err == ESP_OK)
                {
                    device.setAppEui( appEui );
                    result = true;
                }
            }
            nvs_close( handle );
        }

        return result;
    }
} /* namespace lorawan */
