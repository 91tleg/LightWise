#include "manager_init.hpp"

#include <array>
#include <cstdint>

#include "device_init.hpp"

#include "modules/lorawan/payloads/uplink_payload_v1.hpp"
#include "config/keys.hpp"
#include "types/lorawan_keys.hpp"

namespace mgr
{
    namespace
    {

        constinit filter::EMA< float > sAmbientFilterA { 0.1f };
        constinit filter::EMA< float > sAmbientFilterB { 0.1f };
        constinit filter::EMA< uint8_t > sTempFilter   { 0.1f };
        constinit filter::EMA< uint8_t > sHumFilter    { 0.1f };

        constinit std::array< uint8_t, lorawan::UplinkPayloadV1::kSize > sLorawanBuf {};

        constinit lorawan::UplinkPayloadV1 sUplinkPayload {};

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

        lorawan::Manager sLorawanManager { device::xLwnodePrimary,
                                           sUplinkPayload,
                                           sLorawanBuf };

        fsm::Manager sFsmManager {};

    } /* anonymous namespace */

    void init()
    {
        lorawan::Keys keys {};
        if( lorawan::loadKeysFromNvs( keys ) )
        {
            static_cast< void >( sLorawanManager.setup( keys ) );
        }
        keys = lorawan::Keys{};
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

} /* namespace mgr */
