#ifndef TEST_MOCKS_FREERTOS_SEMPHR_H
#define TEST_MOCKS_FREERTOS_SEMPHR_H

#include "FreeRTOS.h"

typedef struct
{
    bool isLocked;
} StaticSemaphore_t;

typedef void * SemaphoreHandle_t;
typedef void * QueueHandle_t;

inline SemaphoreHandle_t xSemaphoreCreateMutexStatic( StaticSemaphore_t * pxBuffer )
{
    SemaphoreHandle_t handle { nullptr } ;
    if( pxBuffer != nullptr )
    {
        pxBuffer->isLocked = false;
        handle = ( SemaphoreHandle_t ) pxBuffer;
    }

    return handle;
}

inline BaseType_t xSemaphoreTake( SemaphoreHandle_t xSemaphore, TickType_t xBlockTime )
{
    BaseType_t result { pdFALSE };
    auto * sem = static_cast< StaticSemaphore_t * >( xSemaphore );
    if( !sem->isLocked )
    {
        sem->isLocked = true;
        result = pdTRUE;
    }
    return result;
}

inline BaseType_t xSemaphoreGive( SemaphoreHandle_t xSemaphore )
{
    auto * sem = static_cast< StaticSemaphore_t * >( xSemaphore );
    sem->isLocked = false;
    return pdTRUE;
}

#endif /* TEST_MOCKS_FREERTOS_SEMPHR_H */