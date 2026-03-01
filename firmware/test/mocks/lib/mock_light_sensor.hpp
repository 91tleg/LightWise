#ifndef TEST_MOCKS_LIB_MOCK_LIGHT_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_LIGHT_SENSOR_HPP

#include <gmock/gmock.h>
#include "lib/light/light_sensor.hpp"

using namespace light;

class MockLightSensor : public LightSensor
{
public:
    MOCK_METHOD( bool, getLevel, ( uint8_t & level ), ( const override ) );
    MOCK_METHOD( bool, setLevel, ( uint8_t level ),   ( override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_LIGHT_SENSOR_HPP */
