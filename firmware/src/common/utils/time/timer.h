#ifndef SRC_COMMON_UTILS_TIME_TIMER_H
#define SRC_COMMON_UTILS_TIME_TIMER_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Get the current system time in microseconds.
 *
 * @return uint64_t Current time in microseconds.
 */
uint64_t timer_get_time_us( void );

#ifdef __cplusplus
}
#endif

#endif /* SRC_COMMON_UTILS_TIME_TIMER_H */
