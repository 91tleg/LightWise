#include "common/system/system_control.h"
#include <esp_system.h>

void system_reboot( void )
{
    esp_restart();
}
