#include "c4001.h"

#include <esp_err.h>

bool c4001_hal_init( const C4001Hw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        const uart_config_t config =
        {
            .baud_rate  = ( int ) hw->baud,
            .data_bits  = UART_DATA_8_BITS,
            .parity     = UART_PARITY_DISABLE,
            .stop_bits  = UART_STOP_BITS_1,
            .flow_ctrl  = UART_HW_FLOWCTRL_DISABLE,
            .source_clk = UART_SCLK_DEFAULT
        };

        esp_err_t err = uart_param_config( hw->uartNum, &config );
        if( err == ESP_OK )
        {
            err = uart_set_pin( hw->uartNum,
                                ( int ) hw->txPin,
                                ( int ) hw->rxPin,
                                UART_PIN_NO_CHANGE,
                                UART_PIN_NO_CHANGE );
            if( err == ESP_OK )
            {
                err = uart_driver_install( hw->uartNum,
                                           ( int ) hw->rxBufSize,
                                           ( int ) hw->txBufSize,
                                           0,
                                           NULL,
                                           0 );
                if( err == ESP_OK )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

bool c4001_hal_deinit( const C4001Hw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        /* Ignoring return value here since failure cannot be handled at this point */
        ( void ) uart_driver_delete( hw->uartNum );

        ( void ) uart_set_pin( hw->uartNum,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE,
                               UART_PIN_NO_CHANGE );

        result = true;
    }

    return result;
}

bool c4001_hal_write( const C4001Hw * const hw,
                      const uint8_t * const data,
                      size_t len )
{
    bool result = false;

    if( ( hw != NULL ) && ( data != NULL ) )
    {
        const int written = uart_write_bytes( hw->uartNum,
                                              ( const void * ) data,
                                              len );
        if( written == ( int ) len )
        {
            /* Wait for TX to complete */
            const esp_err_t err = uart_wait_tx_done( hw->uartNum, 
                                                     pdMS_TO_TICKS( 100U ) );
            if( err == ESP_OK )
            {
                result = true;
            }
        }
    }

    return result;
}

int c4001_hal_read( const C4001Hw * const hw,
                    uint8_t * const buf,
                    size_t maxLen,
                    uint32_t timeoutMs )
{
    int len = 0;

    if( ( hw != NULL ) && (  buf != NULL ) && ( maxLen > 0U ) )
    {
        len = uart_read_bytes( hw->uartNum,
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

bool c4001_hal_flush( const C4001Hw * const hw )
{
    bool result = false;

    if( hw != NULL )
    {
        const esp_err_t err = uart_flush_input( hw->uartNum );

        if( err == ESP_OK )
        {
            result = true;
        }
    }

    return result;
}

size_t c4001_hal_available( const C4001Hw * const hw )
{
    size_t available = 0U;

    if( hw != NULL )
    {
        const esp_err_t err = uart_get_buffered_data_len( hw->uartNum, 
                                                          &available );
        if( err != ESP_OK )
        {
            available = 0U;
        }
    }
    return available;
}
