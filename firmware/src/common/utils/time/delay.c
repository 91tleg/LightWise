#include "delay.h"

#include <esp_rom_sys.h>

#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

void delay_ms( uint32_t delayMs )
{
    if( delayMs > 0U )
    {
        vTaskDelay( pdMS_TO_TICKS( delayMs ) );
    }
}

void delay_us( uint32_t delayUs )
{
    if( delayUs > 0U )
    {
        esp_rom_delay_us( delayUs );
    }
}
