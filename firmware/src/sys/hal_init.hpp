#ifndef SRC_HAL_INIT_HPP
#define SRC_HAL_INIT_HPP

#include "hal/alspt19.h"
#include "hal/c4001.h"
#include "hal/dht11.h"
#include "hal/led.h"
#include "hal/lwnode.h"

namespace hal
{
    void init();

    extern AlsPt19Hw xAlspt19Primary;
    extern AlsPt19Hw xAlspt19Secondary;
    extern C4001Hw xC4001Primary;
    extern C4001Hw xC4001Secondary;
    extern Dht11Hw xDht11Primary;
    extern LedHw xLed;
    extern LwnodeHw xLwnodePrimary;
} /* namespace hal */

#endif /* SRC_HAL_INIT_HPP */
