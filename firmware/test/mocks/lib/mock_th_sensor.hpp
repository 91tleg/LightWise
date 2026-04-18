#ifndef TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP

#include <gmock/gmock.h>
#include "lib/th/th_sensor.hpp"

using namespace th;

class MockTHSensor : public THSensor
{
public:
    MOCK_METHOD( bool, read, ( int8_t & temperature, uint8_t & humidity ),
                 ( const, noexcept, override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP */
