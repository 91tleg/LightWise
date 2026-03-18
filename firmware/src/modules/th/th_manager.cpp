#include "th_manager.hpp"
#include "lib/th/th_sensor.hpp"

namespace th
{

    Manager::Manager( THSensor & sensor,
                      filter::EMA< uint8_t > & tempFilter,
                      filter::EMA< uint8_t > & humFilter ) noexcept
        : sensor_     { sensor     }
        , tempFilter_ { tempFilter }
        , humFilter_  { humFilter  }
    {

    }

    bool Manager::update( Data & data ) noexcept
    {
        uint8_t rawTemp { 0U };
        uint8_t rawHum  { 0U };

        const bool readOk { sensor_.get().read( rawTemp, rawHum ) };

        uint8_t filteredTemp { 0U };
        uint8_t filteredHum  { 0U };
    
        const bool tempOk { readOk &&
                            tempFilter_.get().update(rawTemp, filteredTemp ) };

        const bool humOk { readOk &&
                           humFilter_.get().update(rawHum, filteredHum ) };

        const bool tempInRange { tempOk &&
                                 ( filteredTemp >= kReadingMinValue ) &&
                                 ( filteredTemp <= kReadingMaxValue ) };

        const bool humInRange { humOk &&
                                ( filteredHum >= kReadingMinValue ) &&
                                ( filteredHum <= kReadingMaxValue ) };

        const bool result { tempInRange && humInRange };

        const SensorHealth health { result ? SensorHealth::SYSTEM_OK
                                           : SensorHealth::TOTAL_FAILURE };

        data.temperature = result ? filteredTemp : 0U;
        data.humidity    = result ? filteredHum  : 0U;
        data.health      = health;

        return result;
    }

} /* namespace th */
