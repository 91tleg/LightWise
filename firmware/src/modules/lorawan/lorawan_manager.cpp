#include "lorawan_manager.hpp"

#include "hal/lwnode.h"
#include "keys.hpp"
#include "lib/lorawan/lorawan_sensor.hpp"
#include "payloads/uplink_payload.hpp"
#include "types/lorawan_data.hpp"
#include "utils/log.h"

#define TAG "LwnodeManager"

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

    if( !load_keys_from_nvs( device_ ) )
    {
        LOGE( TAG, "load_keys_from_nvs failed" );
    }
    else if( !device_.begin() )
    {
        LOGE( TAG, "begin failed" );
    }
    else
    {
        LOGI( TAG, "Configuring LoRaWAN..." );

        if( !device_.setRegion( LorawanSensor::Region::US915 ) )
        {
            LOGE( TAG, "setRegion failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.setClass( LorawanSensor::DeviceClass::A ) )
        {
            LOGE( TAG, "setClass failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.setDatarate( 3U ) )
        {
            LOGE( TAG, "setDatarate failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.setEirp( 16U ) )
        {
            LOGE( TAG, "setEirp failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.setSubband( 2U ) )
        {
            LOGE( TAG, "setSubband failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.enableAdr( false ) )
        {
            LOGE( TAG, "enableAdr failed" );
        }
        lwnode_hal_delay_ms( 300U );

        if( !device_.setPacketType( LorawanSensor::PacketType::UNCONFIRMED ) )
        {
            LOGE( TAG, "setPacketType failed" );
        }
        lwnode_hal_delay_ms( 300U );

        LOGI( TAG, "Sending JOIN request" );
        if( device_.join() )
        {
            while( !device_.isJoined() )
            {
                LOGI( TAG, "Waiting for JOIN accept..." );
                lwnode_hal_delay_ms( 5000U );
            }

            LOGI( TAG, "JOIN successful" );
            result = true;
        }
        else
        {
            LOGE( TAG, "JOIN request failed" );
        }
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
