#include "device_init.hpp"

#include "hal_init.hpp"
#include "hal/alspt19.h"
#include "hal/c4001.h"
#include "hal/aht20.h"
#include "hal/led.h"
#include "hal/lwnode.h"
#include "utils/log/log.h"

namespace device
{

    namespace
    {

        constexpr char kTag[] { "DeviceInit" };

    } /* anonymous namespace */

    constinit ambient::Alspt19 alsPt19Primary { hal::alspt19Primary };
    constinit ambient::Alspt19 alsPt19Secondary { hal::alspt19Secondary };
    constinit light::Led led { hal::led };
    constinit mmwave::C4001 c4001Primary { hal::c4001Primary };
    constinit mmwave::C4001 c001Secondary { hal::c4001Secondary };
    constinit th::Aht20 aht20Primary { hal::aht20Primary };
    constinit lorawan::Lwnode lwnodePrimary { hal::lwnodePrimary };
    constinit light::LedProbe ledPresence { hal::ledDetect };

    void init()
    {
        if( !aht20Primary.init() )
        {
            LOGE( kTag, "AHT20 init failed" );
        }
    }

} /* namespace device */
