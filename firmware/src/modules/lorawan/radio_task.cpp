#include "radio_task.hpp"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "lorawan_manager.hpp"

namespace lorawan
{

    void radioTask( void * pvParameters ) noexcept
    {
        RadioTaskParams & params { *static_cast< RadioTaskParams * >( pvParameters ) };

        for( ;; )
        {
            params.mgr.poll();
            vTaskDelay( pdMS_TO_TICKS( 1U ) );
        }
    }

}
