#include "lwnode.h"

#include <string.h>

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#include <esp_err.h>

#define LWNODE_I2C_FREQ_HZ         ( 400000U )
#define LWNODE_I2C_TIMEOUT_MS      ( 100U )
#define LWNODE_MAX_TRANSFER_LEN    ( 256U )

bool lwnode_hal_init( LwnodeHw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
        sensor->busHandle = NULL;
        sensor->devHandle = NULL;

        const i2c_master_bus_config_t bus_config =
        {
            .i2c_port = sensor->port,
            .sda_io_num = sensor->sdaPin,
            .scl_io_num = sensor->sclPin,
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .glitch_ignore_cnt = 7U,
            .intr_priority = 0U,
            .trans_queue_depth = 8U,
            .flags.enable_internal_pullup = true
        };

        esp_err_t err = i2c_new_master_bus( &bus_config,
                                            &sensor->busHandle );

        if( err == ESP_OK )
        {
            const i2c_device_config_t dev_config =
            {
                .dev_addr_length = I2C_ADDR_BIT_LEN_7,
                .device_address = sensor->i2cAddr,
                .scl_speed_hz = LWNODE_I2C_FREQ_HZ,
                .flags.disable_ack_check = false
            };

            err = i2c_master_bus_add_device( sensor->busHandle,
                                             &dev_config,
                                             &sensor->devHandle );

            if( err == ESP_OK )
            {
                result = true;
            }
            else
            {
                /* Failed to add device, cleanup */
                err = i2c_del_master_bus( sensor->busHandle );

                if( err == ESP_OK )
                {
                    sensor->busHandle = NULL;
                }
            }
        }
    }

    return result;
}

bool lwnode_hal_deinit( LwnodeHw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
        if( ( sensor->devHandle == NULL ) && 
            ( sensor->busHandle == NULL ) )
        {
            result = true;
        }
        else
        {
            esp_err_t err = ESP_OK;

            if( sensor->devHandle != NULL )
            {
                err = i2c_master_bus_rm_device( sensor->devHandle );

                if( err == ESP_OK )
                {
                    sensor->devHandle = NULL;
                }
            }

            if( sensor->busHandle != NULL )
            {
                err = i2c_del_master_bus( sensor->busHandle );
            
                if( err == ESP_OK )
                {
                    sensor->busHandle = NULL;
                }
            }

            if( err == ESP_OK)
            {
                result = true;
            }
        }
    }

    return result;
}

bool lwnode_hal_write( const LwnodeHw * const sensor,
                       uint8_t reg,
                       const uint8_t * const data,
                       size_t len )
{
    bool result = false;

    if( ( sensor != NULL ) && ( data != NULL ) &&
        ( len <= LWNODE_MAX_TRANSFER_LEN ) )
    {
        /* Build transfer buffer: [REG][DATA...] */
        uint8_t buffer[ 1U + len ];
        buffer[ 0 ] = reg;
        ( void ) memcpy( &buffer[ 1 ], data, len );

        const esp_err_t err = i2c_master_transmit( 
            sensor->devHandle,
            buffer,
            ( len + 1U ),
            pdMS_TO_TICKS( LWNODE_I2C_TIMEOUT_MS ) );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

bool lwnode_hal_read( const LwnodeHw * const sensor,
                      uint8_t reg,
                      uint8_t * const data,
                      size_t len )
{
    bool result = false;

    if( ( sensor != NULL ) && ( sensor->devHandle != NULL ) && 
        ( data != NULL ) )
    {
        const esp_err_t err = i2c_master_transmit_receive( 
            sensor->devHandle,
            &reg,
            1U,
            data,
            len,
            pdMS_TO_TICKS( LWNODE_I2C_TIMEOUT_MS ) );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

void lwnode_hal_delay_ms( uint32_t delayMs )
{
    if( delayMs > 0U )
    {
        vTaskDelay( pdMS_TO_TICKS( delayMs ) );
    }
}
