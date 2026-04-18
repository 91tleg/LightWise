#ifndef SRC_SYS_DEVICE_INIT_HPP
#define SRC_SYS_DEVICE_INIT_HPP

#include "lib/ambient/alspt19.hpp"
#include "lib/mmwave/c4001.hpp"
#include "lib/light/led.hpp"
#include "lib/th/dht11.hpp"
#include "lib/lorawan/lwnode.hpp"

namespace device
{

    extern ambient::Alspt19 alsPt19Primary;
    extern ambient::Alspt19 alsPt19Secondary;
    extern light::Led led;
    extern mmwave::C4001 c4001Primary;
    extern mmwave::C4001 c001Secondary;
    extern th::Dht11 dht11Primary;
    extern lorawan::Lwnode lwnodePrimary;

} /* namespace device */

#endif /* SRC_SYS_DEVICE_INIT_HPP */
