#ifndef TEST_MOCKS_HAL_AHT20_H
#define TEST_MOCKS_HAL_AHT20_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct I2cBus
{
    uint8_t dummy;
} I2cBus;

typedef struct Aht20Hw
{
    uint8_t dummy;
} Aht20Hw;

bool aht20_hal_init( Aht20Hw * hw, I2cBus * bus );

bool aht20_hal_deinit( Aht20Hw * hw );

bool aht20_hal_write( const Aht20Hw * hw,
                      uint8_t reg,
                      const uint8_t * data,
                      size_t len );

bool aht20_hal_read( const Aht20Hw * hw,
                     uint8_t reg,
                     uint8_t * data,
                     size_t len );

bool aht20_hal_read_raw( const Aht20Hw * hw,
                         uint8_t * data,
                         size_t len );

#ifdef __cplusplus
}
#endif

#endif /* TEST_MOCKS_HAL_AHT20_H */
