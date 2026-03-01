#pragma once

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct LedHw
{
    
} LedHw;

bool led_hal_init( const LedHw * hw );
bool led_hal_deinit( const LedHw * hw );
bool led_hal_set_level( const LedHw * hw, uint32_t adcValue );

#ifdef __cplusplus
}
#endif
