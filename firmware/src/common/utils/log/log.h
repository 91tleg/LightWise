#ifndef SRC_COMMON_UTILS_LOG_LOG_H
#define SRC_COMMON_UTILS_LOG_LOG_H

#if !defined( NDEBUG )

#include <esp_log.h>

#define LOGI( tag, fmt, ... ) ESP_LOGI( tag, fmt, ##__VA_ARGS__ )

#define LOGW( tag, fmt, ... ) ESP_LOGW( tag, fmt, ##__VA_ARGS__ )

#define LOGE( tag, fmt, ... ) ESP_LOGE( tag, fmt, ##__VA_ARGS__ )

#define LOGD( tag, fmt, ... ) ESP_LOGD( tag, fmt, ##__VA_ARGS__ )

#else /* NDEBUG */

#define LOGI( tag, fmt, ... ) ( ( void ) 0 )

#define LOGW( tag, fmt, ... ) ( ( void ) 0 )

#define LOGE( tag, fmt, ... ) ( ( void ) 0 )

#define LOGD( tag, fmt, ... ) ( ( void ) 0 )

#endif /* NDEBUG */

#endif /* SRC_COMMON_UTILS_LOG_LOG_H */
