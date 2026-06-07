#ifndef TEST_MOCKS_LIB_MOCK_LED_PRESENCE_HPP
#define TEST_MOCKS_LIB_MOCK_LED_PRESENCE_HPP

#include <gmock/gmock.h>
#include "lib/light/led_presence.hpp"

namespace light
{
    class MockLedPresence : public LedPresence
    {
    public:
        MOCK_METHOD( bool, isPresent, (), ( const, noexcept, override ) );
    };
} /* namespace light */

#endif /* TEST_MOCKS_LIB_MOCK_LED_PRESENCE_HPP */
