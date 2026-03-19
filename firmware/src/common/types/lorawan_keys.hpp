#ifndef SRC_COMMON_TYPES_LORAWAN_KEYS_HPP
#define SRC_COMMON_TYPES_LORAWAN_KEYS_HPP

#include <array>

namespace lorawan
{

    /**
     * @brief Fixed-size container for LoRaWAN session/activation keys.
     */
    struct Keys
    {
        static constexpr uint8_t kAppEuiHexLen { 16U }; /**< 8 bytes → 16 hex chars  */
        static constexpr uint8_t kAppKeyHexLen { 32U }; /**< 16 bytes → 32 hex chars */

        std::array< char, kAppEuiHexLen + 1U > appEui {}; /**< Null-terminated hex string */
        std::array< char, kAppKeyHexLen + 1U > appKey {}; /**< Null-terminated hex string */
    };

} /* namespace lorawan */

#endif /* SRC_COMMON_TYPES_LORAWAN_KEYS_HPP */