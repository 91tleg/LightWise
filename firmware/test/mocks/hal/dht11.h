#ifndef TEST_MOCKS_HAL_DHT11_H
#define TEST_MOCKS_HAL_DHT11_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct Dht11Hw 
{
    
} Dht11Hw;

bool dht11_hal_set_output( const Dht11Hw * sensor );
bool dht11_hal_set_input( const Dht11Hw * sensor );
bool dht11_hal_write( const Dht11Hw * sensor, uint32_t level );
bool dht11_hal_read( const Dht11Hw * sensor, uint32_t * level );

#ifdef __cplusplus
}
#endif

#endif /* TEST_MOCKS_HAL_DHT11_H */