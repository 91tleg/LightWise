#ifndef SRC_SYS_HAL_INIT_HPP
#define SRC_SYS_HAL_INIT_HPP

#include "hal/alspt19.h"
#include "hal/c4001.h"
#include "hal/aht20.h"
#include "hal/led.h"
#include "hal/lwnode.h"
#include "hal/led_detect.h"

namespace hal
{

    void init();

    extern AlsPt19Hw alspt19Primary;
    extern AlsPt19Hw alspt19Secondary;
    extern C4001Hw c4001Primary;
    extern C4001Hw c4001Secondary;
    extern Aht20Hw aht20Primary;
    extern LedHw led;
    extern LwnodeHw lwnodePrimary;
    extern LedDetect ledDetect;

} /* namespace hal */

#endif /* SRC_SYS_HAL_INIT_HPP */
