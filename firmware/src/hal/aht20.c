#include "aht20.h"
#include "i2c_bus.h"
 
#define AHT20_I2C_TIMEOUT_MS ( 100 )

bool aht20_hal_init( Aht20Hw * const hw, I2cBus * const bus )
{
    bool ok = false;

    if( ( hw != NULL ) && ( bus != NULL ) )
    {
        hw->bus    = bus;
        hw->handle = NULL;

        ok = i2c_bus_add_device( bus, hw->addr, &hw->handle );

        if( !ok )
        {
            hw->bus = NULL;
        }
    }

    return ok;
}

bool aht20_hal_deinit( Aht20Hw * const hw )
{
    bool ok = false;

    if( hw != NULL )
    {
        if( hw->handle == NULL )
        {
            ok = true;  /* already de-initialized */
        }
        else
        {
            ok = i2c_bus_remove_device( hw->handle );

            if( ok )
            {
                hw->handle = NULL;
                hw->bus    = NULL;
            }
        }
    }

    return ok;
}

bool aht20_hal_write( const Aht20Hw * const hw,
                      uint8_t reg,
                      const uint8_t * const data,
                      size_t len )
{
    bool ok = false;

    if( ( hw != NULL ) && ( hw->handle != NULL ) )
    {
        ok = i2c_bus_write( hw->handle, reg, data, len );
    }

    return ok;
}

bool aht20_hal_read( const Aht20Hw * const hw,
                     uint8_t reg,
                     uint8_t * const data,
                     size_t len )
{
    bool ok = false;

    if( ( hw != NULL ) && ( hw->handle != NULL ) )
    {
        ok = i2c_bus_read( hw->handle, reg, data, len );
    }

    return ok;
}

bool aht20_hal_read_raw( const Aht20Hw * const hw,
                         uint8_t * const data,
                         size_t len )
{
    bool ok = false;

    if( ( hw != NULL ) && ( hw->handle != NULL ) &&
        ( data != NULL ) && ( len > 0U ) )
    {
        ok = ( i2c_master_receive( hw->handle,
                                   data,
                                   len,
                                   AHT20_I2C_TIMEOUT_MS ) == ESP_OK );
    }

    return ok;
}
