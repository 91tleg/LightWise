#ifndef TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP

#include <gmock/gmock.h>
#include "lib/ambient/ambient_sensor.hpp"

using namespace ambient;

class MockAmbientSensor : public AmbientSensor 
{
public:
    MOCK_METHOD( bool, read, ( float & lux ), ( const, noexcept, override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP */
