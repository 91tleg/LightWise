#include "i2c_bus.h"
#include <string.h>

#define I2C_FREQ_HZ       ( 400000UL )
#define I2C_TIMEOUT_MS    ( 100 )
#define I2C_MAX_WRITE_LEN ( 256U )

bool i2c_bus_init( I2cBus * const bus )
{
    bool ok = false;

    if( bus != NULL )
    {
        if( bus->handle != NULL )
        {
            ok = true;  /* already initialized */
        }
        else
        {
            const i2c_master_bus_config_t cfg =
            {
                .i2c_port                     = bus->port,
                .scl_io_num                   = bus->scl,
                .sda_io_num                   = bus->sda,
                .clk_source                   = I2C_CLK_SRC_DEFAULT,
                .glitch_ignore_cnt            = 7U,
                .intr_priority                = 0,
                .flags.enable_internal_pullup = true,
            };

            ok = ( i2c_new_master_bus( &cfg, &bus->handle ) == ESP_OK );

            if( !ok )
            {
                bus->handle = NULL;
            }
        }
    }

    return ok;
}

bool i2c_bus_deinit( I2cBus * const bus )
{
    bool ok = false;

    if( bus != NULL )
    {
        if( bus->handle == NULL )
        {
            ok = true;  /* already de-initialized */
        }
        else
        {
            ok = ( i2c_del_master_bus( bus->handle ) == ESP_OK );

            if( ok )
            {
                bus->handle = NULL;
            }
        }
    }

    return ok;
}

bool i2c_bus_add_device( I2cBus * const bus,
                         uint16_t addr,
                         i2c_master_dev_handle_t * const out )
{
    bool ok = false;

    if( ( bus != NULL ) && ( out != NULL ) && ( bus->handle != NULL ) )
    {
        const i2c_device_config_t cfg =
        {
            .dev_addr_length = I2C_ADDR_BIT_LEN_7,
            .device_address  = addr,
            .scl_speed_hz    = I2C_FREQ_HZ,
        };

        ok = ( i2c_master_bus_add_device( bus->handle, &cfg, out ) == ESP_OK );

        if( !ok )
        {
            *out = NULL;
        }
    }

    return ok;
}

bool i2c_bus_remove_device( i2c_master_dev_handle_t dev )
{
    bool ok = true;  /* NULL dev is not an error */

    if( dev != NULL )
    {
        ok = ( i2c_master_bus_rm_device( dev ) == ESP_OK );
    }

    return ok;
}

bool i2c_bus_write( i2c_master_dev_handle_t dev,
                    uint8_t reg,
                    const uint8_t * const data,
                    size_t len )
{
    bool ok = false;

    if( ( dev != NULL ) && ( data != NULL ) &&
        ( len > 0U ) && ( len <= I2C_MAX_WRITE_LEN ) )
    {
        /* Build a single contiguous buffer: [ reg | data... ] */
        uint8_t buf[ 1U + I2C_MAX_WRITE_LEN ];
        buf[ 0U ] = reg;
        memcpy( &buf[ 1U ], data, len );

        ok = ( i2c_master_transmit( dev,
                                    buf,
                                    1U + len,
                                    I2C_TIMEOUT_MS ) == ESP_OK );
    }

    return ok;
}

bool i2c_bus_read( i2c_master_dev_handle_t dev,
                   uint8_t reg,
                   uint8_t * const data,
                   size_t len )
{
    bool ok = false;

    if( ( dev != NULL ) && ( data != NULL ) && ( len > 0U ) )
    {
        ok = ( i2c_master_transmit_receive( dev,
                                            &reg, 1U,
                                            data, len,
                                            I2C_TIMEOUT_MS ) == ESP_OK );
    }

    return ok;
}
