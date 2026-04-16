#include "lwnode.h"
#include "i2c_bus.h"

bool lwnode_hal_init( LwnodeHw * const hw, I2cBus * const bus )
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

bool lwnode_hal_deinit( LwnodeHw * const hw )
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

bool lwnode_hal_write( const LwnodeHw * const hw,
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

bool lwnode_hal_read( const LwnodeHw * const hw,
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
