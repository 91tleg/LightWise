#include "timer.h"
#include <esp_timer.h>

uint64_t timer_get_time_us( void )
{
    const int64_t timeUs = esp_timer_get_time();
    uint64_t result = 0U;

    if( timeUs >= 0 )
    {
        result = ( uint64_t ) timeUs;
    }
    else
    {
        /* Fallback */
        result = 0U;
    }

    return result;
}
