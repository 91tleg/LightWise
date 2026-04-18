#include "th_manager.hpp"
#include "lib/th/th_sensor.hpp"
#include "types/th_data.hpp"

namespace th
{

    Manager::Manager( THSensor & sensor,
                      filter::EMA< int8_t > & tempFilter,
                      filter::EMA< uint8_t > & humFilter ) noexcept
        : sensor_     { sensor     }
        , tempFilter_ { tempFilter }
        , humFilter_  { humFilter  }
    {

    }

    bool Manager::update( Data & data ) noexcept
    {
        int8_t rawTemp { 0  };
        uint8_t rawHum { 0U };

        const bool readOk { sensor_.read( rawTemp, rawHum ) };

        int8_t filteredTemp { 0  };
        uint8_t filteredHum { 0U };
    
        const bool tempOk { readOk &&
                            tempFilter_.update( rawTemp, filteredTemp ) };

        const bool humOk { readOk &&
                           humFilter_.update( rawHum, filteredHum ) };

        const bool tempInRange { tempOk &&
                                 ( filteredTemp >= kTempReadingMinValue ) &&
                                 ( filteredTemp <= kTempReadingMaxValue ) };

        const bool humInRange { humOk &&
                                ( filteredHum >= kHumReadingMinValue ) &&
                                ( filteredHum <= kHumReadingMaxValue ) };

        const bool result { tempInRange && humInRange };

        const SensorHealth health { result ? SensorHealth::SYSTEM_OK
                                           : SensorHealth::TOTAL_FAILURE };

        data.temperature = result ? filteredTemp : 0;
        data.humidity    = result ? filteredHum  : 0U;
        data.health      = health;

        return result;
    }

} /* namespace th */
