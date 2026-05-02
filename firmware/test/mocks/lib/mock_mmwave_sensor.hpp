#ifndef TEST_MOCKS_LIB_MOCK_MMWAVE_SENSOR_HPP
#define TEST_MOCKS_LIB_MOCK_MMWAVE_SENSOR_HPP

#include <gmock/gmock.h>
#include "lib/mmwave/mmwave_sensor.hpp"

using namespace mmwave;

class MockMmwaveSensor : public MmwaveSensor
{
public:
    MOCK_METHOD( bool, connect,             (),                    ( noexcept, override ) );
    MOCK_METHOD( bool, setSensorMode,       ( Mode ),              ( noexcept, override ) );
    MOCK_METHOD( bool, setDetectionRange,   ( uint16_t, uint16_t, uint16_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, setTrigSensitivity,  ( uint8_t ),           ( noexcept, override ) );
    MOCK_METHOD( bool, setKeepSensitivity,  ( uint8_t ),           ( noexcept, override ) );
    MOCK_METHOD( bool, setDelay,            ( uint8_t, uint16_t ), ( noexcept, override ) );
    MOCK_METHOD( bool, motionDetected,      ( bool & ),            ( noexcept, override ) );
    MOCK_METHOD( bool, setGpioPolarity,     ( uint8_t ),           ( noexcept, override ) );
};

#endif /* TEST_MOCKS_LIB_MOCK_MMWAVE_SENSOR_HPP */
