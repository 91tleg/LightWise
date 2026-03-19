#ifndef SRC_COMMON_UTILS_TIME_DELAY_H
#define SRC_COMMON_UTILS_TIME_DELAY_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif
/**
 * @brief Delay execution for a number of milliseconds.
 *
 * Uses FreeRTOS vTaskDelay.
 *
 * @param delayMs Number of milliseconds to delay.
 */
void delay_ms( uint32_t delayMs );

/**
 * @brief Delay execution for a number of microseconds.
 *
 * Uses ESP ROM delay function.
 *
 * @param delayUs Number of microseconds to delay.
 */
void delay_us( uint32_t delayUs );

#ifdef __cplusplus
}
#endif

#endif /* SRC_COMMON_UTILS_TIME_DELAY_H */
