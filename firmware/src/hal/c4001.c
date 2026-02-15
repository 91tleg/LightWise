#include "c4001.h"

#include <esp_err.h>
#include <esp_timer.h>

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

bool c4001_hal_init( C4001Hw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
        const uart_config_t config =
        {
            .baud_rate  = sensor->baud,
            .data_bits  = UART_DATA_8_BITS,
            .parity     = UART_PARITY_DISABLE,
            .stop_bits  = UART_STOP_BITS_1,
            .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
            .source_clk = UART_SCLK_DEFAULT
        };

        esp_err_t err = uart_param_config( sensor->uartNum, &config );
        if( err == ESP_OK )
        {
            err = uart_set_pin( sensor->uartNum,
                                sensor->txPin,
                                sensor->rxPin,
                                UART_PIN_NO_CHANGE,
                                UART_PIN_NO_CHANGE );
            if( err == ESP_OK )
            {
                err = uart_driver_install( sensor->uartNum,
                                           ( int ) sensor->rxBufSize,
                                           ( int ) sensor->txBufSize,
                                           0,
                                           NULL,
                                           0 );
                if( err == ESP_OK )
                {
                    vTaskDelay( pdMS_TO_TICKS( 1000U ) );  /* Sensor stabilization */
                    result = true;
                }
            }
        }
    }

    return result;
}

bool c4001_hal_deinit( C4001Hw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
        /* Ignoring return value here since failure cannot be handled at this point */
        ( void ) uart_driver_delete( sensor->uartNum );

        ( void ) uart_set_pin( sensor->uartNum,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE );

        result = true;
    }

    return result;
}

bool c4001_hal_write( const C4001Hw * const sensor,
                      const uint8_t * const data,
                      size_t len )
{
    bool result = false;

    if( ( sensor != NULL ) && ( data != NULL ) )
    {
        const int written = uart_write_bytes( sensor->uartNum,
                                              ( const void * ) data,
                                              ( int ) len);
        
        if( written == ( int ) len )
        {
            /* Wait for TX to complete */
            const esp_err_t err = uart_wait_tx_done( sensor->uartNum, 
                                                     pdMS_TO_TICKS( 100U ) );
            if( err == ESP_OK )
            {
                result = true;
            }
        }
    }

    return result;
}

int c4001_hal_read( const C4001Hw * const sensor,
                    uint8_t * const buf,
                    size_t maxLen,
                    uint32_t timeoutMs )
{
    int len = 0;

    if( ( sensor != NULL ) && (  buf != NULL ) )
    {
        len = uart_read_bytes( sensor->uartNum,
                               buf,
                               ( uint32_t ) maxLen,
                               pdMS_TO_TICKS( timeoutMs ) );

        if( len < 0 )
        {
            len = 0;
        }
    }

    return len;
}

bool c4001_hal_flush( const C4001Hw * const sensor )
{
    bool result = false;

    if( sensor != NULL )
    {
        const esp_err_t err = uart_flush_input( sensor->uartNum );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

size_t c4001_hal_available( const C4001Hw * const sensor )
{
    size_t available = 0U;

    if( sensor != NULL )
    {
        const esp_err_t err = uart_get_buffered_data_len( sensor->uartNum, 
                                                          &available );
        if( err != ESP_OK )
        {
            available = 0U;
        }
    }
    return available;
}

void c4001_hal_delay_ms( uint32_t delayMs )
{
    if( delayMs > 0U )
    {
        vTaskDelay( pdMS_TO_TICKS( delayMs ) );
    }
}

int64_t c4001_hal_timer_get_time_ms( void )
{
    return esp_timer_get_time() / 1000; /* Convert µs to ms */
}
