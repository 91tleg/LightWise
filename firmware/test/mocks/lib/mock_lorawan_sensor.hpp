#include "lib/lorawan/lorawan_sensor.hpp"
#include <cstdint>
#include <gmock/gmock.h>

using namespace lorawan;

class MockLorawanSensor : public LorawanSensor
{
  public:
    MOCK_METHOD( bool, begin, (), ( noexcept, override ) );
    MOCK_METHOD( bool, setAppKey, ( const char * ), ( noexcept, override ) );
    MOCK_METHOD( bool, setAppEui, ( const char * ), ( noexcept, override ) );
    MOCK_METHOD( bool, join, (), ( noexcept, override ) );
    MOCK_METHOD( bool, isJoined, (), ( noexcept, override ) );
    MOCK_METHOD( bool, setRegion, ( LorawanSensor::Region ), ( noexcept, override ) );
    MOCK_METHOD( bool, setClass, ( LorawanSensor::DeviceClass ), ( noexcept, override ) );
    MOCK_METHOD( bool, setDatarate, ( uint8_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, setEirp, ( uint8_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, setSubband, ( uint8_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, enableAdr, ( bool ), ( noexcept, override ) );
    MOCK_METHOD( bool, setPacketType, ( PacketType ), ( noexcept, override ) );
    MOCK_METHOD( bool, sendPacket, ( const uint8_t *, uint8_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, setRxCb, ( LorawanSensor::RxCallback ), ( noexcept, override ) );
};
