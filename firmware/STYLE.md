# C Style Guide

This is the quick-reference guide. Follow these rules to keep code consistent, safe, and production-ready.

---
## General guidelines
- Only `/*` and `*/` should be used to start and end comments.
- All comments end with a period.
- Use of goto is discouraged.
- Only spaces should be used for indenting. A single indent is 4 spaces. NO tab characters should be used.
- A parenthesis is usually followed by a space.
- Lines of code should be less than 80 characters long, although longer lines are permitted.
- Local variables should be declared at the top of a block in the narrowest scope possible. Reducing complexity could be a valid case for breaking this guideline, so this should be done at the programmer's discretion.
- All global variables should be declared at the top of a file.
- Variables are always initialized.
- All files must include the config file at the top of the file before any other includes.
- static functions must have a declaration at the top of the file and be implemented before any application-facing functions.
- Sizes and lengths should be represented with `size_t`.

---

## Static Analysis

Run static checks locally:

```bash
pio check
```

Fix all warnings before submitting PRs.

---

## File Layout

### Include Order

Always use this order:
1. Project headers
2. FreeRTOS headers
3. ESP-IDF / SDK headers
4. Standard library headers

```c
#include "module.h"

#include <freertos/FreeRTOS.h>
#include <sdk_header.h>
```

---

## Naming Conventions

### Functions

- Use snake_case
- Prefer verb-based names for actions.
- Module prefix required.

```c
void uart_driver_init( void );
```

---

### Variables

- Use camelCase
- Use type-prefixed Hungarian notation if needed:

| Prefix | Meaning |
|------|-------|
| uc | uint8_t |
| us | uint16_t |
| ul | uint32_t |
| ull | uint64_t |
| c	| char |
| pc | pointer to char |
| b	| bool |
| x	| generic struct/handle |
| pv | pointer to void |
| px | pointer to struct |
| e	| enum |
| f	| float |
| d	| double |

```c
uint32_t ulPacketCount;
uint8_t ucRxByte;
BaseType_t xResult;
bool bIsConnected;
char * pcBuffer;
void * pvUserData;
```

---

### Structs

- Use UpperCamelCase
- Prefix with module name if needed
- Avoid `_t` suffix unless typedefed
- Pointer variables use `px` prefix

```c
typedef struct UartConfig
{
    uint32_t baudRate;
    uint8_t dataBits;
    uint8_t parity;
} UartConfig;
```

---

### Enums

- Use UpperCamelCase for enum type
- Use UPPER_SNAKE_CASE for enum values
- Prefix values with enum type or module name

```c
typedef enum UartStatus
{
    UART_STATUS_OK,
    UART_STATUS_ERROR,
    UART_STATUS_BUSY
} UartStatus;
```

### Macros

- UPPER_SNAKE_CASE

```c
#define MAX_BUFFER_SIZE   ( 256U )
#define UART_TIMEOUT_MS   ( 1000U )
```

---

## Pointers

```c
uint8_t * pucBuffer;
const char * pcName;
void * pvContext;
```

---

### Return Values

All return values must be used or explicitly discarded.

```c
( void ) gpio_install_isr_service( 0 );
```

---

## Logging

- Always use project-specific logging macros:

```c
LOGI( TAG, "Init OK" );
LOGE( TAG, "Error %d", ( int ) err );
LOGW( TAG, "Low memory" );
LOGD( TAG, "Value %lu", ulValue );
```
**Never** use `printf()`.

---

## Memory

- Avoid dynamic memory (malloc/free).
- Prefer static buffers, stack allocation, or static FreeRTOS objects.

```c
static uint8_t ucBuffer[ 128 ];
static StaticTask_t xTaskBuffer;
static StackType_t xStack[ 512 ];
```

- Prefer Static FreeRTOS APIs

```c
xTaskCreateStatic( ... );
xQueueCreateStatic( ... );
xSemaphoreCreateBinaryStatic( ... );
```

---

## ISR

- Use only ISR-safe FreeRTOS APIs
- Do not block
- Do not allocate memory
- Fast

```c
BaseType_t xHigherPriorityTaskWoken = pdFALSE;
xQueueSendFromISR( xQueue, &ucData, &xHigherPriorityTaskWoken );
portYIELD_FROM_ISR( xHigherPriorityTaskWoken );
```

---

## Type Safety

- Always cast explicitly when mixing types:

```c
return ( count == ( int ) length );
```

- Use U suffix for unsigned constants where appropriate:

```c
gpio_set_level( pin, 1U );
#define MAX_RETRIES   ( 5U )
```

- Use UL for constants larger than 32-bit int:

```c
#define MAX_TIMEOUT   ( 0xFFFFFFFFUL )
```

---

## Assertions

- Use `configASSERT()` for runtime checks:

```c
configASSERT( status == ESP_OK );
```

---

### Return Status

- All public functions must clearly document return values and error conditions.

---

## Code Review Checklist

Before requesting review, verify:

- `clang-format` was run
- clang-tidy / cppcheck clean
- `pio check` passes
- No compiler warnings
- ISR safe
- No heap misuse
- Naming conventions followed
- Forward declarations present
- Static functions forward-declared

---

## Final Notes

Just a guide :3

**Document Version**: 1.0   
**Last Updated**: January 30, 2026  
