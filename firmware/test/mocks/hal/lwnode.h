#ifndef TEST_MOCKS_HAL_LWNODE_H
#define TEST_MOCKS_HAL_LWNODE_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct LwnodeHw
{

} LwnodeHw;

bool lwnode_hal_init( LwnodeHw * sensor );

bool lwnode_hal_deinit( LwnodeHw * sensor );

bool lwnode_hal_write( const LwnodeHw * sensor,
                       uint8_t reg,
                       const uint8_t * data,
                       size_t len );

bool lwnode_hal_read( const LwnodeHw * sensor,
                      uint8_t reg,
                      uint8_t * data,
                      size_t len );

#ifdef __cplusplus
}
#endif

#endif /* TEST_MOCKS_HAL_LWNODE_H */
