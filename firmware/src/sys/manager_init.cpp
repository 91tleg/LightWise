#include "manager_init.hpp"

#include <cstddef>
#include <cstdint>

#include "device_init.hpp"

#include "modules/ambient/ambient_manager.hpp"
#include "modules/th/th_manager.hpp"
#include "modules/mmwave/mmwave_manager.hpp"
#include "modules/light/light_manager.hpp"
#include "modules/lorawan/lorawan_manager.hpp"
#include "modules/fsm/fsm_manager.hpp"
#include "config/config_store.hpp"

#include "config/keys.hpp"
#include "types/lorawan_keys.hpp"
#include "config/nvs_config_store.hpp"
#include "utils/time/timer.h"
#include "utils/security/secure_zero.hpp"
#include "utils/log/log.h"

namespace mgr
{
    namespace
    {

        constexpr char kTag[] { "ManagerInit" };

        constinit filter::EMA< float > sAmbientFilterA { 0.1f };
        constinit filter::EMA< float > sAmbientFilterB { 0.1f };
        constinit filter::EMA< int8_t  > sTempFilter   { 0.1f };
        constinit filter::EMA< uint8_t > sHumFilter    { 0.1f };

        constinit config::SystemConfig sSystemConfig {};

        ambient::Manager sAmbientManager { device::alsPt19Primary,
                                           device::alsPt19Secondary,
                                           sAmbientFilterA,
                                           sAmbientFilterB };

        th::Manager sThManager { device::dht11Primary,
                                 sTempFilter,
                                 sHumFilter };

        mmwave::Manager sMmwaveManager { device::c4001Primary,
                                         device::c001Secondary };

        light::Manager sLightManager { device::led };

        lorawan::Manager sLorawanManager { device::lwnodePrimary };

        fsm::Manager sFsmManager {};

        config::NvsConfigStore sConfigStore {};

    } /* anonymous namespace */

    void init()
    {
        static_cast< void >( sConfigStore.load( sSystemConfig ) );

        fsm::Config fsmConfig {};
        fsmConfig.maxLevel = sSystemConfig.maxLevel;
        fsmConfig.dimLevel = sSystemConfig.dimLevel;
        sFsmManager.setConfig( fsmConfig );

        LOGI( kTag, "Config: maxLevel=%u dimLevel=%u motionTimeout=%us heartbeat=%umin",
              static_cast< unsigned >( sSystemConfig.maxLevel       ),
              static_cast< unsigned >( sSystemConfig.dimLevel       ),
              static_cast< unsigned >( sSystemConfig.motionTimeoutS ),
              static_cast< unsigned >( sSystemConfig.heartbeatMin   ) );

        lorawan::Keys keys {};
        if( lorawan::loadKeysFromNvs( keys ) )
        {
            const uint32_t nowMs { static_cast< uint32_t >( timer_get_time_us() / 1000UL ) };
            static_cast< void >( sLorawanManager.setup( keys, nowMs ) );
        }
        security::secureZero( keys );
    }

    ambient::Manager & getAmbientManager() noexcept 
    {
        return sAmbientManager;
    }

    th::Manager & getThManager() noexcept
    {
        return sThManager;
    }

    mmwave::Manager & getMmwaveManager() noexcept
    {
        return sMmwaveManager;
    }

    light::Manager & getLightManager() noexcept
    {
        return sLightManager;
    }

    lorawan::Manager & getLorawanManager() noexcept
    {
        return sLorawanManager;
    }

    fsm::Manager & getFsmManager() noexcept
    {
        return sFsmManager;
    }

    config::ConfigStore & getConfigStore() noexcept
    {
        return sConfigStore;
    }

    config::SystemConfig & getSystemConfig() noexcept
    {
        return sSystemConfig;
    }

} /* namespace mgr */
