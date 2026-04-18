#ifndef SRC_SYS_HAL_INIT_HPP
#define SRC_SYS_HAL_INIT_HPP

#include "hal/alspt19.h"
#include "hal/c4001.h"
#include "hal/dht11.h"
#include "hal/led.h"
#include "hal/lwnode.h"

namespace hal
{

    void init();

    extern AlsPt19Hw alspt19Primary;
    extern AlsPt19Hw alspt19Secondary;
    extern C4001Hw c4001Primary;
    extern C4001Hw c4001Secondary;
    extern Dht11Hw dht11Primary;
    extern LedHw led;
    extern LwnodeHw lwnodePrimary;

} /* namespace hal */

#endif /* SRC_SYS_HAL_INIT_HPP */
