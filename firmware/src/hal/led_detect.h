#ifndef LED_DETECT_H
#define LED_DETECT_H

#include <stddef.h>
#include <stdbool.h>
#include <driver/gpio.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct LedDetect
{
    gpio_num_t pin;
} LedDetect;

bool led_detect_init( LedDetect * detect );
bool led_detect_deinit( LedDetect * detect );
bool led_detect_read( LedDetect * detect, bool * unplugged );

#ifdef __cplusplus
}
#endif

#endif /* LED_DETECT_H */
