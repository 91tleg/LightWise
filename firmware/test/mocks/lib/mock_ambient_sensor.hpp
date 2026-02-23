#ifndef TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP

#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "lib/ambient/ambient_sensor.hpp"

using namespace ambient;
using ::testing::_;
using ::testing::DoAll;
using ::testing::Return;
using ::testing::SetArgReferee;

class MockAmbientSensor : public AmbientSensor 
{
public:
    MOCK_METHOD( bool, init, (), ( override ) );
    MOCK_METHOD( bool, read, ( float & lux ), ( const, override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_AMBIENT_SENSOR_HPP */
