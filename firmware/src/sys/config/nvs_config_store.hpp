#ifndef SRC_SYS_CONFIG_STORE_NVS_CONFIG_STORE_HPP
#define SRC_SYS_CONFIG_STORE_NVS_CONFIG_STORE_HPP

#include <cstdint>

#include <nvs.h>

#include "config/config_store.hpp"

namespace config
{

    class NvsConfigStore final : public ConfigStore
    {
    public:
        NvsConfigStore()  = default;
        ~NvsConfigStore() = default;

        [[nodiscard]] bool load( SystemConfig & config ) noexcept override;
        [[nodiscard]] bool save( const SystemConfig & config ) noexcept override;

    private:

        static constexpr char kNamespace       [] { "lwnode_cfg" };
        static constexpr char kKeyMaxLevel     [] { "maxLevel"   };
        static constexpr char kKeyDimLevel     [] { "dimLevel"   };
        static constexpr char kKeyMotionTimeout[] { "motionTout" };
        static constexpr char kKeyMotionSens   [] { "motionSens" };
        static constexpr char kKeyHeartbeat    [] { "heartbeat"  };
    };

} /* namespace config */

#endif /* SRC_SYS_CONFIG_STORE_NVS_CONFIG_STORE_HPP */
