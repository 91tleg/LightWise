#ifndef TEST_MOCKS_HAL_ALSPT19_H
#define TEST_MOCKS_HAL_ALSPT19_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct AlsPt19Hw
{

} AlsPt19Hw;

bool alspt19_hal_read_raw( const AlsPt19Hw * sensor, 
                           uint16_t * out );

#ifdef __cplusplus
}
#endif

#endif /* TEST_MOCKS_HAL_ALSPT19_H */
