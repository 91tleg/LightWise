#ifndef SRC_MODULES_LORAWAN_KEYS_HPP
#define SRC_MODULES_LORAWAN_KEYS_HPP

namespace lorawan
{
    class LorawanSensor;

    /**
     * @brief Load LoRaWAN credentials from NVS and apply them to a device.
     *
     * Reads the application key (AppKey) and application EUI (AppEui)
     * from ESP-IDF non-volatile storage and configures the provided
     * LoRaWAN sensor instance.
     *
     * NVS namespace: "lwnode"  
     * Keys:
     *  - "appkey" : Hex-encoded AppKey string
     *  - "appEui" : Hex-encoded AppEUI string
     *
     * @param[in,out] device LoRaWAN sensor to configure.
     *
     * @retval true  Both AppKey and AppEui were successfully loaded and set.
     * @retval false One or more keys could not be read or applied.
     *
     * @note The provided device is modified only if corresponding keys
     *       are successfully read.
     * @note NVS must be initialized before calling this function.
     */
    bool load_keys_from_nvs( LorawanSensor & device );
} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_KEYS_HPP */
