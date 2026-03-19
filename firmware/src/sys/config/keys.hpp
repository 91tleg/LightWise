#ifndef SRC_SYS_CONFIG_KEYS_HPP
#define SRC_SYS_CONFIG_KEYS_HPP

namespace lorawan
{

    struct Keys;

    /**
     * @brief  Load LoRaWAN activation keys from NVS namespace "lwnode".
     *
     * Opens NVS read-only, reads "appkey" and "appEui" string entries,
     * and populates keys on success.  Stack buffers holding key material
     * are zeroed before return.
     *
     * @param  keys  Filled with appKey and appEui on success.
     * @return true  if both keys were loaded successfully.
     * @return false if NVS open failed or either key was missing.
     */
    [[nodiscard]] bool loadKeysFromNvs( Keys & keys ) noexcept;

} /* namespace lorawan */

#endif /* SRC_SYS_CONFIG_KEYS_HPP */
