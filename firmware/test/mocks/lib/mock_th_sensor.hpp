#ifndef TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP

#include "lib/th/th_sensor.hpp"
#include <gmock/gmock.h>
#include <gtest/gtest.h>

using namespace th;
using ::testing::_;
using ::testing::DoAll;
using ::testing::Return;
using ::testing::SetArgReferee;

class MockTHSensor : public THSensor
{
  public:
    MOCK_METHOD( bool, init, (), ( override ) );
    MOCK_METHOD( bool, read, ( uint8_t & temperature, uint8_t & humidity ), ( const, override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_TH_SENSOR_HPP */
