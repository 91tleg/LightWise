#ifndef TEST_MOCKS_FREERTOS_FREERTOS_H
#define TEST_MOCKS_FREERTOS_FREERTOS_H

#include <cstdint>
#include <cstdio>
#include <cstdlib>

typedef uint32_t TickType_t;
typedef uint32_t BaseType_t;
typedef uint32_t UBaseType_t;

#define pdFALSE ( ( BaseType_t ) 0 )
#define pdTRUE  ( ( BaseType_t ) 1 )
#define pdPASS  ( pdTRUE )
#define pdFAIL  ( pdFALSE )

#define portMAX_DELAY ( 0xFFFFFFFFU )
#define pdMS_TO_TICKS( xTimeInMs ) ( ( TickType_t ) xTimeInMs )
#define configASSERT( x ) if( !( x ) ) { printf("ASSERT FAILED\n"); abort(); }

typedef enum {
    eNoAction = 0,
    eSetBits,
    eIncrement,
    eSetValueWithOverwrite,
    eSetValueWithoutOverwrite
} eNotifyAction;

#endif /* TEST_MOCKS_FREERTOS_FREERTOS_H */
