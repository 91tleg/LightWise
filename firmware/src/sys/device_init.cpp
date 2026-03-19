#include "device_init.hpp"

#include "hal_init.hpp"
#include "hal/alspt19.h"
#include "hal/c4001.h"
#include "hal/dht11.h"
#include "hal/led.h"
#include "hal/lwnode.h"
#include "utils/log/log.h"

namespace device
{

    namespace
    {

        constexpr char kTag[] { "DeviceInit" };

    } /* anonymous namespace */

    constinit ambient::Alspt19 xAlsPt19Primary( &hal::xAlspt19Primary );
    constinit ambient::Alspt19 xAlsPt19Secondary( &hal::xAlspt19Secondary );
    constinit light::Led xLed( &hal::xLed );
    constinit mmwave::C4001 xC4001Primary( &hal::xC4001Primary );
    constinit mmwave::C4001 xC001Secondary( &hal::xC4001Secondary );
    constinit th::Dht11 xDht11Primary( &hal::xDht11Primary );
    constinit lorawan::Lwnode xLwnodePrimary( &hal::xLwnodePrimary );

    void init()
    {
        if( !xAlsPt19Primary.init() )
        {
            LOGE( kTag, "Alspt19 primary init failed" );
        }

        if( !xAlsPt19Secondary.init() )
        {
            LOGE( kTag, "Alspt19 secondary init failed" );
        }

        if( !xC4001Primary.init() )
        {
            LOGE( kTag, "C4001 primary init failed" );
        }

        if( !xC001Secondary.init() )
        {
            LOGE( kTag, "C4001 secondary init failed" );
        }

        if( !xDht11Primary.init() )
        {
            LOGE( kTag, "Dht11 primary init failed" );
        }

        if( !xLed.init() )
        {
            LOGE( kTag, "Led init failed" );
        }

        if( !xLwnodePrimary.init() )
        {
            LOGE( kTag, "Lwnode init failed" );
        }
    }

} /* namespace device */
