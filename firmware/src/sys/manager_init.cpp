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
        constinit filter::EMA< uint8_t > sTempFilter   { 0.1f };
        constinit filter::EMA< uint8_t > sHumFilter    { 0.1f };

        ambient::Manager sAmbientManager { device::xAlsPt19Primary,
                                           device::xAlsPt19Secondary,
                                           sAmbientFilterA,
                                           sAmbientFilterB };

        th::Manager sThManager { device::xDht11Primary,
                                 sTempFilter,
                                 sHumFilter };

        mmwave::Manager sMmwaveManager { device::xC4001Primary,
                                         device::xC001Secondary };

        light::Manager sLightManager { device::xLed };

        lorawan::Manager sLorawanManager { device::xLwnodePrimary };

        fsm::Manager sFsmManager {};

        config::NvsConfigStore sConfigStore {};

    } /* anonymous namespace */

    void init()
    {
        config::SystemConfig config {};
        static_cast< void >( sConfigStore.load( config ) );

        fsm::Config fsmConfig {};
        fsmConfig.maxLevel = config.maxLevel;
        fsmConfig.dimLevel = config.dimLevel;
        sFsmManager.setConfig( fsmConfig );

        LOGI( kTag, "Config: maxLevel=%u dimLevel=%u motionTimeout=%us heartbeat=%umin",
              static_cast< unsigned >( config.maxLevel       ),
              static_cast< unsigned >( config.dimLevel       ),
              static_cast< unsigned >( config.motionTimeoutS ),
              static_cast< unsigned >( config.heartbeatMin   ) );

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

} /* namespace mgr */
