#ifndef SRC_SYS_DEVICE_INIT_HPP
#define SRC_SYS_DEVICE_INIT_HPP

#include "lib/ambient/alspt19.hpp"
#include "lib/mmwave/c4001.hpp"
#include "lib/light/led.hpp"
#include "lib/th/dht11.hpp"
#include "lib/lorawan/lwnode.hpp"

namespace device
{

    extern ambient::Alspt19 xAlsPt19Primary;
    extern ambient::Alspt19 xAlsPt19Secondary;
    extern light::Led xLed;
    extern mmwave::C4001 xC4001Primary;
    extern mmwave::C4001 xC001Secondary;
    extern th::Dht11 xDht11Primary;
    extern lorawan::Lwnode xLwnodePrimary;

} /* namespace device */

#endif /* SRC_SYS_DEVICE_INIT_HPP */
