#include "fsm_manager.hpp"

#include "types/sensor_health.hpp"

namespace fsm
{
    namespace 
    {
        constexpr uint8_t kDefaultBrightenLevel = 100U; /**< When downlink is enabled, pull user config from NVS */
        constexpr uint8_t kDefaultDimLevel = 30U;
        constexpr float kAmbientThreshold = 1000.0f;
    } /* anonymous namespace */

    Manager::Manager()
        : lastPrimaryMotion_( false ), 
          lastSecondaryMotion_( false )
    {

    }

    Manager::Outputs Manager::update( const Inputs & inputs )
    {
        Outputs out{};

        /* Default */
        out.lightLevel = kDefaultBrightenLevel;

        if( inputs.ambient.lux <= kAmbientThreshold )
        {
            const bool motionDetected = inputs.mmwave.motionDetected;
            out.lightLevel = motionDetected ? kDefaultBrightenLevel : kDefaultDimLevel;
            out.uplinkData.lux_x10 =
                static_cast<uint16_t>( inputs.ambient.lux * 10.0f );
            out.uplinkData.tempC   = inputs.th.temperature;
            out.uplinkData.humidity = inputs.th.humidity;
            out.uplinkData.lightLevel = out.lightLevel;
        }

        out.uplinkData.flags = computeFlags( inputs );

        return out;
    }

    uint8_t Manager::computeFlags( const Inputs & inputs )
    {
        const bool motionDetected = inputs.mmwave.motionDetected;
        const bool ambientPrimaryOk = ( inputs.ambient.health != SensorHealth::TOTAL_FAILURE ) &&
                                        ( inputs.ambient.health != SensorHealth::PRIMARY_FAIL );
        const bool ambientSecondaryOk = ( inputs.ambient.health != SensorHealth::TOTAL_FAILURE ) &&
                                          ( inputs.ambient.health != SensorHealth::SECONDARY_FAIL );
        const bool thOk = ( inputs.th.health == SensorHealth::SYSTEM_OK );
        const bool MotionPrimaryOk = ( inputs.mmwave.health != SensorHealth::TOTAL_FAILURE ) &&
                                       ( inputs.mmwave.health != SensorHealth::PRIMARY_FAIL );
        const bool MotionSecondaryOk = ( inputs.mmwave.health != SensorHealth::TOTAL_FAILURE ) &&
                                         ( inputs.mmwave.health != SensorHealth::SECONDARY_FAIL );
        const bool systemDegraded = ( inputs.ambient.health == SensorHealth::DEGRADED ) ||
                                      ( inputs.mmwave.health  == SensorHealth::DEGRADED ) ||
                                      ( inputs.th.health     == SensorHealth::DEGRADED );
        const bool overallOk = ambientPrimaryOk && thOk && MotionPrimaryOk && !systemDegraded;

        uint8_t flags = 0U;

        if( motionDetected )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::MotionPresent );
        }
        if( ambientPrimaryOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::AmbientPrimaryOk );
        }
        if( ambientSecondaryOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::AmbientSecondaryOk );
        }
        if( thOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::ThOk );
        }
        if( MotionPrimaryOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::MotionPrimaryOk );
        }
        if( MotionSecondaryOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::MotionSecondaryOk );
        }
        if( systemDegraded )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::SystemDegraded );
        }
        if( overallOk )
        {
            flags |= static_cast<uint8_t>( lorawan::UplinkData::StatusFlag::OverallOk );
        }
        return flags;
    }

} /* namespace fsm */
