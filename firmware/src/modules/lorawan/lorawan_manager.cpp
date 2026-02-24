#include "lorawan_manager.hpp"

#include "keys.hpp"
#include "lib/lorawan/lorawan_sensor.hpp"
#include "payloads/uplink_payload.hpp"
#include "types/lorawan_data.hpp"

namespace lorawan
{
    Manager::Manager( LorawanSensor & device, UplinkPayload & payload )
        : device_( device ),
          payload_( payload )
    {

    }

    bool Manager::setup()
    {
        bool result = false;

        if( load_keys_from_nvs( device_ ) )
        {
            result = true;
        }

        return result;
    }

    bool Manager::sendUplink( const UplinkData & data )
    {
        bool result = false;

        uint8_t buf[ payload_.size() ]{};

        payload_.encode( data, buf );

        if( device_.sendPacket( buf, payload_.size() ) )
        {
            result = true;
        }
        
        return result;
    }
} /* namespace lorawan */
