#include "led_probe.hpp"
#include "hal/led_detect.h"

namespace light
{
    bool LedProbe::isPresent() const noexcept
    {
        bool present { false };
        bool unplugged { false };

        if( led_detect_read( &detect_, &unplugged ) )
        {
            present = !unplugged;
        }

        return present;
    }

} /* namespace light */
