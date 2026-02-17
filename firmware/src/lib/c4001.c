#include "c4001.h"

#include <stddef.h>
#include <string.h>

#include "hal/c4001.h"
#include "utils/str_ext.h"
#include "utils/num_fmt.h"

/* Command strings */
#define C4001_CMD_START_SENSOR           "sensorStart"
#define C4001_CMD_STOP_SENSOR            "sensorStop"
#define C4001_CMD_SAVE_CONFIG            "saveConfig"
#define C4001_CMD_RESET_CONFIG           "resetCfg"
#define C4001_CMD_RESET_SYSTEM           "resetSystem"
#define C4001_CMD_EXIST_MODE             "setRunApp 0"
#define C4001_CMD_SPEED_MODE             "setRunApp 1"

#define C4001_CMD_GET_SENSITIVITY        "getSensitivity"
#define C4001_CMD_GET_LATENCY            "getLatency"
#define C4001_CMD_GET_RANGE              "getRange"
#define C4001_CMD_GET_TRIG_RANGE         "getTrigRange"
#define C4001_CMD_GET_THR_FACTOR         "getThrFactor"
#define C4001_CMD_GET_MICRO_MOTION       "getMicroMotion"

/* Buffer and timeout configuration */
#define C4001_RX_MAX_BYTES               ( 256U )
#define C4001_CMD_MAX_BYTES              ( 64U )
#define C4001_UART_READ_TIMEOUT_MS       ( 200U )

/* Retry configuration */
#define C4001_POLL_START_RETRY_COUNT     ( 5U )
#define C4001_POLL_START_RETRY_DELAY_MS  ( 1000U )

/* Range validation constants */
#define C4001_RANGE_MIN_CM               ( 30U )
#define C4001_RANGE_MAX_CM               ( 2000U )
#define C4001_RANGE_MIN_MAX_THRESHOLD    ( 240U )
#define C4001_THR_MAX                    ( 2500U )
#define C4001_SENSITIVITY_MAX            ( 9U )
#define C4001_TRIG_DELAY_MAX             ( 200U )
#define C4001_KEEP_DELAY_MIN             ( 4U )
#define C4001_KEEP_DELAY_MAX             ( 3000U )
#define C4001_TARGET_FLASH_MAX           ( 10U )

/* Sensor command delays */
#define C4001_DELAY_AFTER_START_MS             ( 200U )
#define C4001_DELAY_AFTER_STOP_MS              ( 200U )
#define C4001_DELAY_AFTER_RESET_MS             ( 1500U )

/* Configuration save sequence delays */
#define C4001_DELAY_BEFORE_MODE_CMD_MS         ( 50U )
#define C4001_DELAY_AFTER_MODE_CMD_MS          ( 50U )
#define C4001_DELAY_BEFORE_SAVE_CFG_MS         ( 50U )
#define C4001_DELAY_AFTER_SAVE_CFG_MS          ( 500U )
#define C4001_DELAY_AFTER_CONFIG_START_MS      ( 100U )
#define C4001_DELAY_AFTER_STOP_CMD_MS          ( 1000U )

/* Command sequence delays */
#define C4001_DELAY_AFTER_CMD_MS               ( 100U )
#define C4001_DELAY_AFTER_CMD_SAVE_MS          ( 100U )
#define C4001_DELAY_AFTER_CMD_START_MS         ( 100U )

/* Command prefixes with lengths */
#define C4001_SET_RANGE_PREFIX                  "setRange "
#define C4001_SET_RANGE_PREFIX_LEN \
    ( sizeof( C4001_SET_RANGE_PREFIX ) - 1U )

#define C4001_SET_TRIG_RANGE_PREFIX             "setTrigRange "
#define C4001_SET_TRIG_RANGE_PREFIX_LEN \
    ( sizeof( C4001_SET_TRIG_RANGE_PREFIX ) - 1U )

#define C4001_SET_TRIG_SENSITIVITY_PREFIX       "setSensitivity 255 "
#define C4001_SET_TRIG_SENSITIVITY_PREFIX_LEN \
    ( sizeof( C4001_SET_TRIG_SENSITIVITY_PREFIX ) - 1U )

#define C4001_SET_SENSITIVITY_PREFIX            "setSensitivity "
#define C4001_SET_SENSITIVITY_PREFIX_LEN \
    ( sizeof( C4001_SET_SENSITIVITY_PREFIX ) - 1U )

#define C4001_SET_LATENCY_PREFIX                "setLatency "
#define C4001_SET_LATENCY_PREFIX_LEN \
    ( sizeof( C4001_SET_LATENCY_PREFIX ) - 1U )

#define C4001_SET_THR_PREFIX                    "setThrFactor "
#define C4001_SET_THR_PREFIX_LEN \
    ( sizeof( C4001_SET_THR_PREFIX ) - 1U )

#define C4001_SET_MICRO_MOTION_PREFIX           "setMicroMotion "
#define C4001_SET_MICRO_MOTION_PREFIX_LEN \
    ( sizeof( C4001_SET_MICRO_MOTION_PREFIX ) - 1U )

/* Response parsing structure */
typedef struct
{
    bool status;
    float response1;
    float response2;
    float response3;
} ResponseData;

static bool c4001_write_cmd( const C4001Device * const device, 
                             const char * const str );

static bool c4001_sensor_stop( C4001Device * const device );

static bool c4001_cmd_stop_save_start( C4001Device * device, 
                                       const char * const cmd1, 
                                       const char * const cmd2, 
                                       uint8_t count );

static bool c4001_query_response( C4001Device * const device,
                                  const char * const cmd,
                                  uint8_t expectedResponses,
                                  ResponseData * const outData );

static bool c4001_parse_response( const uint8_t * const buf,
                                  size_t len,
                                  uint8_t count,
                                  ResponseData * const outData );

static bool c4001_parse_dfdmd( const uint8_t * const buf, 
                               size_t len, 
                               size_t pos, 
                               C4001Target * const outTgt, 
                               bool * const outExist );

static bool c4001_parse_frame( const uint8_t * const buf,
                               size_t len,
                               C4001Status * const outStatus,
                               bool * const outExist,
                               C4001Target * const outTarget,
                               bool * const hasTarget );

bool c4001_init( C4001Device * const device,
                 C4001Hw * const sensor )
{
    bool result = false;
    
    if( ( device != NULL ) && ( sensor != NULL ) )
    {
        ( void ) memset( device, 0, sizeof( C4001Device ) );
        device->sensor = sensor;
        result = true;
    }
    
    return result;
}

bool c4001_deinit( C4001Device * const device )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        if( c4001_hal_deinit( device->sensor ) )
        {
            device->sensor = NULL;
            result = true;
        }
    }
    
    return result;
}

bool c4001_connect( C4001Device * const device )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        uint8_t buf[ C4001_RX_MAX_BYTES ];
        int len = 0;
        bool hasValidData = false;

        /* Flush and allow sensor to stream */
        c4001_hal_flush(device->sensor);
        c4001_hal_delay_ms( C4001_DELAY_AFTER_START_MS );

        ( void ) memset(buf, 0, sizeof(buf));

        len = c4001_hal_read( device->sensor,
                              buf,
                              sizeof( buf ) - 1U,
                              500U );

        if( len > 0 )
        {
            buf[ len ] = '\0';

            for( int i = 0; i < len; ++i )
            {
                if( ( buf[ i ] >= 32U ) && ( buf[ i ] < 127U ) )
                {
                    hasValidData = true;
                    break;
                }
            }

            if( hasValidData )
            {

                c4001_hal_flush(device->sensor);

                if( c4001_write_cmd( device, C4001_CMD_STOP_SENSOR ) )
                {
                    c4001_hal_delay_ms( C4001_DELAY_AFTER_STOP_CMD_MS );

                    ( void ) memset( buf, 0, sizeof( buf ) );
                    len = c4001_hal_read( device->sensor,
                                          buf,
                                          sizeof( buf ) - 1U,
                                          1000U );

                    if( len > 0 )
                    {
                        buf[ len ] = '\0';

                        if( ( strstr( ( const char * ) buf, C4001_CMD_STOP_SENSOR ) != NULL ) ||
                            ( strstr( ( const char * ) buf, "$DF" ) != NULL ) )
                        {
                            ( void ) c4001_sensor_stop( device );
                            result = true;
                        }
                    }
                }
            }
        }
    }

    return result;
}


bool c4001_get_status( C4001Device * const device, 
                       C4001Status * const outStatus )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outStatus != NULL ) )
    {    
        uint8_t buf[ C4001_RX_MAX_BYTES ] = {};
        int len = 0;
        
        ( void ) c4001_write_cmd( device, C4001_CMD_START_SENSOR );
        
        for( uint32_t attempt = 0U; attempt < C4001_POLL_START_RETRY_COUNT; ++attempt )
        {
            len = c4001_hal_read( device->sensor,
                                  buf, 
                                  sizeof( buf ),
                                  C4001_UART_READ_TIMEOUT_MS ); 

            if( len > 0 )
            {
                bool exist = false;
                C4001Target tgt;
                bool hasTarget = false;
                
                ( void ) memset( &tgt, 0, sizeof( C4001Target ) );
                
                if( c4001_parse_frame( buf, 
                                       ( size_t ) len, 
                                       outStatus,
                                       &exist,
                                       &tgt,
                                       &hasTarget ) )
                {
                    result = true;
                    break;
                }
            }
            else
            {
                c4001_hal_delay_ms( C4001_POLL_START_RETRY_DELAY_MS );
            }
        }
    }
    
    return result;
}

bool c4001_motion_detected( C4001Device * const device, 
                            bool * const outMotion )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outMotion != NULL ) )
    {
        uint8_t buf[ C4001_RX_MAX_BYTES ];
        int len = 0;
        
        /* Initialize output */
        *outMotion = device->lastExist;
        
        len = c4001_hal_read( device->sensor, 
                              buf, 
                              sizeof( buf ), 
                              C4001_UART_READ_TIMEOUT_MS );

        if( len > 0 )
        {
            C4001Status st;
            bool exist = false;
            C4001Target tgt;
            bool hasTarget = false;
            
            ( void ) memset( &st, 0, sizeof( C4001Status ) );
            ( void ) memset( &tgt, 0, sizeof( C4001Target ) );
            
            if( c4001_parse_frame( buf, 
                                   ( size_t ) len, 
                                   &st, 
                                   &exist, 
                                   &tgt, 
                                   &hasTarget ) )
            {
                device->lastExist = exist;
                *outMotion = exist;
            }
        }
        result = true;
    }
    
    return result;
}

bool c4001_set_sensor_mode( C4001Device * const device, C4001Mode mode )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        result = c4001_sensor_stop( device );
        
        if( result )
        {
            if( mode == C4001_MODE_EXIST )
            {
                result = c4001_write_cmd( device, C4001_CMD_EXIST_MODE );
                c4001_hal_delay_ms( C4001_DELAY_AFTER_MODE_CMD_MS ); 
            }
            else /* C4001_MODE_SPEED */
            {
                result = c4001_write_cmd( device, C4001_CMD_SPEED_MODE );
                c4001_hal_delay_ms( C4001_DELAY_AFTER_MODE_CMD_MS ); 
            }
        }
        
        if( result )
        {
            c4001_hal_delay_ms( C4001_DELAY_BEFORE_SAVE_CFG_MS );
            result = c4001_write_cmd( device, C4001_CMD_SAVE_CONFIG );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_SAVE_CFG_MS );
        }
        
        if( result )
        {
            result = c4001_write_cmd( device, C4001_CMD_START_SENSOR );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CONFIG_START_MS );
        }
    }
    
    return result;
}

bool c4001_set_trig_sensitivity( C4001Device * const device, 
                                 uint8_t sensitivity )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && 
        ( sensitivity <= C4001_SENSITIVITY_MAX ) )
    {
        char cmd[ C4001_CMD_MAX_BYTES ];
        
        const size_t len = C4001_SET_TRIG_SENSITIVITY_PREFIX_LEN;
        
        /* Space for single digit + null terminator */
        if( ( len + 2U ) < sizeof( cmd ) )
        { 
            /* Build "setSensitivity 255 <s>" */
            ( void ) memcpy( cmd, 
                             C4001_SET_TRIG_SENSITIVITY_PREFIX, 
                             C4001_SET_TRIG_SENSITIVITY_PREFIX_LEN );
            cmd[ len ] = '0' + ( char ) sensitivity;
            cmd[ len + 1U ] = '\0';
            
            result = c4001_cmd_stop_save_start( device, cmd, NULL, 1U );
        }
    }
    
    return result;
}

bool c4001_get_trig_sensitivity( C4001Device * const device, 
                                 uint8_t * const outSens )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outSens != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_SENSITIVITY, 
                                  1U, 
                                  &response ) )
        {
            *outSens = ( uint8_t ) response.response1;
            result = true;
        }
    }
    
    return result;
}

bool c4001_set_keep_sensitivity( C4001Device * const device, 
                                 uint8_t sensitivity )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && 
        ( sensitivity <= C4001_SENSITIVITY_MAX ) )
    {
        char cmd[ C4001_CMD_MAX_BYTES ];
        char *p = cmd;
        
        /* Build "setSensitivity <s> 255" */
        ( void ) memcpy( p, 
                         C4001_SET_SENSITIVITY_PREFIX, 
                         C4001_SET_SENSITIVITY_PREFIX_LEN );
        p += C4001_SET_SENSITIVITY_PREFIX_LEN;
        
        /* Sspace for " X 255\0" = 6 chars */
        const size_t remaining = sizeof( cmd ) - C4001_SET_SENSITIVITY_PREFIX_LEN;
        if( remaining >= 6U )
        {
            *p++ = '0' + ( char ) sensitivity;
            *p++ = ' ';
            *p++ = '2';
            *p++ = '5';
            *p++ = '5';
            *p = '\0';
            
            result = c4001_cmd_stop_save_start( device, cmd, NULL, 1U );
        }
    }
    
    return result;
}

bool c4001_get_keep_sensitivity( C4001Device * const device, 
                                 uint8_t * const outSens )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outSens != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_SENSITIVITY, 
                                  2U, 
                                  &response ) )
        {
            *outSens = ( uint8_t ) response.response2;
            result = true;
        }
    }
    
    return result;
}

bool c4001_set_delay( C4001Device * const device,
                      uint8_t trig,
                      uint16_t keep )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        if( ( trig <= C4001_TRIG_DELAY_MAX ) &&
            ( keep >= C4001_KEEP_DELAY_MIN ) &&
            ( keep <= C4001_KEEP_DELAY_MAX ) )
        {
            char cmd[ C4001_CMD_MAX_BYTES ];
            char *p = cmd;
            
            /* Build "setLatency <trig*0.01> <keep*0.5>" */
            ( void ) memcpy( p,
                             C4001_SET_LATENCY_PREFIX,
                             C4001_SET_LATENCY_PREFIX_LEN );
            p += C4001_SET_LATENCY_PREFIX_LEN;
            
            /* Convert trig * 0.01 to tenths */
            p = num_fmt_append_fixed1( p, trig );
            *p++ = ' ';
            
            /* Convert keep * 0.5 to tenths */
            p = num_fmt_append_fixed1( p, keep * 5U );
            *p = '\0';
            
            result = c4001_cmd_stop_save_start( device, cmd, cmd, 1U );
        }
    }
    
    return result;
}

bool c4001_get_delay( C4001Device * const device, 
                      uint16_t * const outMs )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outMs != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_LATENCY, 
                                  1U, 
                                  &response ) )
        {
            /* Response is in seconds, convert to ms (*100 to get centiseconds, *10 to get ms) */
            *outMs = ( uint16_t ) ( response.response1 * 100.0f );
            result = true;
        }
    }
    
    return result;
}

bool c4001_get_keep_timeout_ms( C4001Device * const device, 
                                uint16_t * const outMs )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outMs != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_LATENCY, 
                                  2U, 
                                  &response ) )
        {
            /* Response is in seconds, convert to ms (*2 to match original behavior) */
            *outMs = ( uint16_t ) ( response.response2 * 2.0f * 1000.0f );
            result = true;
        }
    }
    
    return result;
}

bool c4001_set_detection_range( C4001Device * const device,
                                uint16_t minCm,
                                uint16_t maxCm,
                                uint16_t trigCm )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        if( ( maxCm >= C4001_RANGE_MIN_MAX_THRESHOLD ) && 
            ( maxCm <= C4001_RANGE_MAX_CM ) &&
            ( minCm >= C4001_RANGE_MIN_CM ) && 
            ( minCm <= maxCm ) )
        {
            char cmd1[ C4001_CMD_MAX_BYTES ];
            char cmd2[ C4001_CMD_MAX_BYTES ];
            char *p;
            
            /* Convert cm to m with 1 decimal (rounding) */
            const uint16_t minT  = ( minCm  + 5U ) / 10U;
            const uint16_t maxT  = ( maxCm  + 5U ) / 10U;
            const uint16_t trigT = ( trigCm + 5U ) / 10U;
            
            /* Build "setRange <min/10.0> <max/10.0>" */
            p = cmd1;
            ( void ) memcpy( p, 
                             C4001_SET_RANGE_PREFIX,
                             C4001_SET_RANGE_PREFIX_LEN ); 
            p += C4001_SET_RANGE_PREFIX_LEN;
            p = num_fmt_append_fixed1( p, minT );
            *p++ = ' ';
            p = num_fmt_append_fixed1( p, maxT );
            *p = '\0';
            
            /* Build "setTrigRange <trig/10.0>" */
            p = cmd2;
            ( void ) memcpy( p, 
                             C4001_SET_TRIG_RANGE_PREFIX, 
                             C4001_SET_TRIG_RANGE_PREFIX_LEN );
            p += C4001_SET_TRIG_RANGE_PREFIX_LEN;
            p = num_fmt_append_fixed1( p, trigT );
            *p = '\0';
            
            result = c4001_cmd_stop_save_start( device, cmd1, cmd2, 2U );
        }
    }
    
    return result;
}

bool c4001_get_trig_range_cm( C4001Device * const device, 
                              uint16_t * const outCm )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outCm != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_TRIG_RANGE, 
                                  1U, 
                                  &response ) )
        {
            /* Response is in meters, convert to cm */
            *outCm = ( uint16_t ) ( response.response1 * 100.0f );
            result = true;
        }
    }
    
    return result;
}

bool c4001_get_min_range_cm( C4001Device * const device, 
                             uint16_t * const outCm )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outCm != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_RANGE, 
                                  2U, 
                                  &response ) )
        {
            /* Response is in meters, convert to cm */
            *outCm = ( uint16_t ) ( response.response1 * 100.0f );
            result = true;
        }
    }
    
    return result;
}

bool c4001_get_max_range_cm( C4001Device * const device, 
                             uint16_t * const outCm )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outCm != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_RANGE, 
                                  2U, 
                                  &response ) )
        {
            /* Response is in meters, convert to cm */
            *outCm = ( uint16_t ) ( response.response2 * 100.0f );
            result = true;
        }
    }
    
    return result;
}

bool c4001_update_target( C4001Device * const device, 
                          uint8_t * const outNumber )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outNumber != NULL ) )
    {
        uint8_t buf[ C4001_RX_MAX_BYTES ];
        int len = 0;
        
        ( void ) memset( buf, 0, sizeof( buf ) );
        
        len = c4001_hal_read( device->sensor,
                              buf,
                              sizeof( buf ),
                              C4001_UART_READ_TIMEOUT_MS );
        if( len > 0 )
        {
            C4001Status st;
            bool exist = false;
            C4001Target tgt;
            bool hasTarget = false;
            
            ( void ) memset( &st, 0, sizeof( C4001Status ) );
            ( void ) memset( &tgt, 0, sizeof( C4001Target ) );
            
            if( c4001_parse_frame( buf, 
                                   ( size_t ) len, 
                                   &st, 
                                   &exist, 
                                   &tgt, 
                                   &hasTarget ) &&
                hasTarget && ( tgt.number != 0U ) )
            {
                /* Valid target received */
                device->flashCount = 0U;
                device->cache = tgt;
            }
            else
            {
                /* No valid target */
                if( device->flashCount < 255U )
                {
                    device->flashCount++;
                }
                
                if( device->flashCount > C4001_TARGET_FLASH_MAX )
                {
                    ( void ) memset( &device->cache, 0, sizeof( device->cache ) );
                    device->flashCount = 0U;
                }
            }
        }
        else
        {
            /* No data received */
            if( device->flashCount < 255U )
            {
                device->flashCount++;
            }
            
            if( device->flashCount > C4001_TARGET_FLASH_MAX )
            {
                ( void ) memset( &device->cache, 0, sizeof( device->cache ) );
                device->flashCount = 0U;
            }
        }
        
        *outNumber = device->cache.number;
        result = true;
    }
    
    return result;
}

bool c4001_get_target( C4001Device * const device, 
                       C4001Target * const outTarget )
{
    bool result = false;
    
    if( ( device != NULL ) && ( outTarget != NULL ) )
    {
        *outTarget = device->cache;
        result = true;
    }
    
    return result;
}

bool c4001_set_detect_threshold( C4001Device * const device,
                                 uint16_t minCm,
                                 uint16_t maxCm,
                                 uint16_t thres )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        if( ( maxCm <= C4001_THR_MAX ) &&
            ( minCm <= maxCm ) )
        {
            char cmd1[ C4001_CMD_MAX_BYTES ];
            char cmd2[ C4001_CMD_MAX_BYTES ];
            char *p;
            
            /* Convert cm to m with 1 decimal (rounding) */
            const uint16_t minT = ( minCm + 5U ) / 10U;
            const uint16_t maxT = ( maxCm + 5U ) / 10U;
            
            /* Build "setRange <min/10.0> <max/10.0>" */
            p = cmd1;
            ( void ) memcpy( p, 
                             C4001_SET_RANGE_PREFIX, 
                             C4001_SET_RANGE_PREFIX_LEN );
            p += C4001_SET_RANGE_PREFIX_LEN;
            p = num_fmt_append_fixed1( p, minT );
            *p++ = ' ';
            p = num_fmt_append_fixed1( p, maxT );
            *p = '\0';
            
            /* Build "setThrFactor <thres>" */
            p = cmd2;
            ( void ) memcpy( p, 
                             C4001_SET_THR_PREFIX, 
                             C4001_SET_THR_PREFIX_LEN );
            p += C4001_SET_THR_PREFIX_LEN;
            p = num_fmt_append_u16( p, thres );
            *p = '\0';
            
            result = c4001_cmd_stop_save_start( device, cmd1, cmd2, 2U );
        }
    }
    
    return result;
}

bool c4001_get_threshold( C4001Device * const device, 
                          uint16_t * const outThres )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outThres != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_THR_FACTOR, 
                                  1U, 
                                  &response ) )
        {
            *outThres = ( uint16_t ) response.response1;
            result = true;
        }
    }
    
    return result;
}

bool c4001_set_micro_motion( C4001Device * const device, 
                             C4001Switch st )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {
        char cmd[ C4001_CMD_MAX_BYTES ];
        char *p = cmd;
        
        /* Build "setMicroMotion <st>" */
        ( void ) memcpy( p, 
                         C4001_SET_MICRO_MOTION_PREFIX,
                         C4001_SET_MICRO_MOTION_PREFIX_LEN );
        p += C4001_SET_MICRO_MOTION_PREFIX_LEN;
        p = num_fmt_append_u16( p, ( uint16_t ) st );
        *p = '\0';
        
        result = c4001_cmd_stop_save_start( device, cmd, cmd, 1U );
    }
    
    return result;
}

bool c4001_get_micro_motion( C4001Device * const device, 
                             C4001Switch * const outSt )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outSt != NULL ) )
    {
        ResponseData response;
        
        ( void ) memset( &response, 0, sizeof( ResponseData ) );
        
        if( c4001_query_response( device, 
                                  C4001_CMD_GET_MICRO_MOTION, 
                                  1U, 
                                  &response ) )
        {
            *outSt = ( C4001Switch ) ( ( uint8_t ) response.response1 );
            result = true;
        }
    }
    
    return result;
}

bool c4001_set_pwm( C4001Device * const device,
                    uint8_t pwm1,
                    uint8_t pwm2,
                    uint8_t timer )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) &&
        ( pwm1 <= 100U ) && ( pwm2 <= 100U ) )
    {

    }

    return result;
}

bool c4001_set_gpio_polarity( C4001Device * const device, 
                              uint8_t value )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {

    }

    return result;
}

/**
 * @brief Send a command string to the C4001 sensor.
 *
 * This function writes a null-terminated command string to the sensor
 * using the underlying HAL write function.
 *
 * @param[in] device Pointer to initialized C4001 device structure.
 * @param[in] cmd    Null-terminated command string to send.
 *
 * @return true  If the command was successfully written.
 * @return false If parameters are invalid or write fails.
 */
static bool c4001_write_cmd( const C4001Device * const device,
                             const char * const cmd )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( cmd != NULL ) )
    {
        const size_t len = strlen( cmd );
        if( len > 0U )
        {
            if( c4001_hal_write( device->sensor, 
                                 ( const uint8_t * ) cmd, 
                                 len ) )
            {
                result = true;
            }
        }
    }
    
    return result;
}

/**
 * @brief Send stop command to the sensor and confirm acknowledgment.
 *
 * Attempts to stop the sensor. The function verifies success by checking 
 * for the "sensorStop" response string.
 *
 * @param[in,out] device Pointer to initialized C4001 device structure.
 *
 * @return true  If sensor stop is acknowledged.
 * @return false If stop command fails.
 */
static bool c4001_sensor_stop( C4001Device * const device )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {       
        c4001_hal_delay_ms( 1200U );
        if( c4001_write_cmd( device, C4001_CMD_STOP_SENSOR ) )
        {
            uint8_t buf[ C4001_RX_MAX_BYTES ];
            int len = 0;

            /* Wait for sensor to react */
            c4001_hal_delay_ms( 600U );

            /* Read ACK */
            ( void ) memset( buf, 0, sizeof( buf ) );
            len = c4001_hal_read( device->sensor,
                                  buf,
                                  sizeof( buf ) - 1,
                                  500U );

            if( len > 0 )
            {
                buf[ len ] = '\0';

                /* Accept silence or ACK */
                if( strstr( ( char * ) buf, C4001_CMD_STOP_SENSOR ) ||
                    strstr( ( char * ) buf, "$DF" ) )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

/**
 * @brief Stop sensor, send configuration commands, save, and restart.
 *
 * This function performs the following sequence:
 * 1. Stops the sensor
 * 2. Sends the first configuration command
 * 3. Optionally sends a second command
 * 4. Saves configuration
 * 5. Restarts the sensor
 *
 * @param[in,out] device Pointer to initialized C4001 device structure.
 * @param[in]     cmd1   First command to send (required).
 * @param[in]     cmd2   Optional second command (used if count > 1).
 * @param[in]     count  Number of configuration commands (1 or 2).
 *
 * @return true  If all steps complete successfully.
 * @return false If any step fails.
 */
static bool c4001_cmd_stop_save_start( C4001Device * const device, 
                                       const char * const cmd1, 
                                       const char * const cmd2, 
                                       uint8_t count )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && ( cmd1 != NULL ) )
    {
        result = c4001_sensor_stop( device );
        
        /* Write first command */
        if( result )
        {
            result = c4001_write_cmd( device, cmd1 );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_MS );
        }
        
        /* Write optional second command */
        if( result && ( count > 1U ) && ( cmd2 != NULL ) )
        {
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_MS );
            result = c4001_write_cmd( device, cmd2 );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_MS );
        }
        
        /* Save configuration */
        if( result )
        {
            result = c4001_write_cmd( device, C4001_CMD_SAVE_CONFIG );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_SAVE_MS );
        }
        
        /* Start sensor */
        if( result )
        {
            result = c4001_write_cmd( device, C4001_CMD_START_SENSOR );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_START_MS );
        }
    }
    
    return result;
}

/**
 * @brief Send query command and parse response.
 *
 * The function:
 * 1. Stops the sensor
 * 2. Sends the query command
 * 3. Reads response data
 * 4. Parses the expected response values
 * 5. Restarts the sensor
 *
 * @param[in,out] device            Pointer to initialized C4001 device.
 * @param[in]     cmd               Query command string.
 * @param[in]     expectedResponses Number of expected response values.
 * @param[out]    outData           Parsed response structure.
 *
 * @return true  If response is successfully parsed.
 * @return false If communication or parsing fails.
 */
static bool c4001_query_response( C4001Device * const device,
                                  const char * const cmd,
                                  uint8_t expectedResponses,
                                  ResponseData * const outData )
{
    bool result = false;
    
    if( ( device != NULL ) && ( device->sensor != NULL ) && 
        ( cmd != NULL ) && ( outData != NULL ) )
    {
        uint8_t buf[ C4001_RX_MAX_BYTES ];
        int len = 0;
        
        ( void ) memset( outData, 0, sizeof( ResponseData ) );
        ( void ) memset( buf, 0, sizeof( buf ) );
        
        if( c4001_sensor_stop( device ) )
        {
            if( c4001_write_cmd( device, cmd ) )
            {
                c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_MS );
                
                len = c4001_hal_read( device->sensor,
                                      buf,
                                      sizeof( buf ),
                                      C4001_UART_READ_TIMEOUT_MS );
                
                if( len > 0 )
                {
                    result = c4001_parse_response( buf, 
                                                   ( size_t ) len, 
                                                   expectedResponses, 
                                                   outData );
                }
                
                c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_MS );
            }
            
            ( void ) c4001_write_cmd( device, C4001_CMD_START_SENSOR );
            c4001_hal_delay_ms( C4001_DELAY_AFTER_CMD_START_MS );
        }
    }
    
    return result;
}

/**
 * @brief Parse generic response string from sensor.
 *
 * Searches for the "Res" marker and extracts up to three
 * space-separated floating-point values.
 *
 * @param[in]  buf    Pointer to received data buffer.
 * @param[in]  len    Length of buffer.
 * @param[in]  count  Number of expected response values (1–3).
 * @param[out] outData Structure to store parsed results.
 *
 * @return true  If response marker is found and values parsed.
 * @return false If parsing fails or marker not found.
 */
static bool c4001_parse_response( const uint8_t * const buf,
                                  size_t len,
                                  uint8_t count,
                                  ResponseData * const outData )
{
    bool result = false;
    
    if( ( buf != NULL ) && ( outData != NULL ) && ( len > 0U ) )
    {
        size_t i = 0U;
        for( i = 0U; i < len - 2U; ++i )
        {
            if( ( buf[ i ] == 'R' ) && 
                ( buf[ i + 1U ] == 'e' ) && 
                ( buf[ i + 2U ] == 's' ) )
            {
                break;
            }
        }
        
        if( i < ( len - 2U ) )
        {
            /* Found response marker */
            outData->status = true;
            
            /* Find space-separated values after "Res" */
            uint8_t spacePositions[ 4 ] = { 0 };
            uint8_t spaceCount = 0;
            
            for( size_t j = i; j < len && spaceCount < 4U; ++j )
            {
                if( buf[j] == ' ' )
                {
                    spacePositions[ spaceCount++ ] = ( uint8_t )( j + 1U );
                }
            }
            
            if( spaceCount > 0U )
            {
                /* Parse first value */
                char tmp[ 32 ];
                size_t valStart = spacePositions[ 0 ];
                size_t valLen = 0;
                
                /* Find length of first value */
                for( size_t k = valStart; k < len; ++k )
                {
                    if( ( buf[ k ] == ' ' ) || ( buf[ k ] == '\r' ) || 
                        ( buf[ k ] == '\n' ) || ( buf[ k ] == '\0' ) )
                    {
                        break;
                    }
                    valLen++;
                }
                
                if( ( valLen > 0U ) && ( valLen < sizeof( tmp ) ) )
                {
                    ( void ) memcpy( tmp, &buf[ valStart ], valLen );
                    tmp[ valLen ] = '\0';
                    outData->response1 = ( float ) atof( tmp );
                }
                
                /* Parse second value if expected */
                if( ( count >= 2U ) && ( spaceCount >= 2U ) )
                {
                    valStart = spacePositions[ 1 ];
                    valLen = 0;
                    
                    for( size_t k = valStart; k < len; ++k )
                    {
                        if( ( buf[ k ] == ' ' ) || ( buf[ k ] == '\r' ) || 
                            ( buf[ k ] == '\n' ) || ( buf[ k ] == '\0' ) )
                        {
                            break;
                        }
                        valLen++;
                    }
                    
                    if( ( valLen > 0U ) && ( valLen < sizeof( tmp ) ) )
                    {
                        ( void ) memcpy( tmp, &buf[ valStart ], valLen );
                        tmp[valLen] = '\0';
                        outData->response2 = ( float ) atof( tmp );
                    }
                }
                
                /* Parse third value if expected */
                if( ( count >= 3U ) && ( spaceCount >= 3U ) )
                {
                    valStart = spacePositions[ 2 ];
                    valLen = 0;
                    
                    for( size_t k = valStart; k < len; ++k )
                    {
                        if( ( buf[ k ] == ' ' ) || ( buf[ k ] == '\r' ) || 
                            ( buf[ k ] == '\n' ) || ( buf[ k ] == '\0' ) )
                        {
                            break;
                        }
                        valLen++;
                    }
                    
                    if( ( valLen > 0U ) && ( valLen < sizeof( tmp ) ) )
                    {
                        ( void ) memcpy( tmp, &buf[ valStart ], valLen );
                        tmp[valLen] = '\0';
                        outData->response3 = ( float ) atof( tmp );
                    }
                }
                
                result = true;
            }
        }
        else
        {
            /* No response marker found */
            outData->status = false;
        }
    }
    
    return result;
}

/**
 * @brief Parse $DFDMD (Target Tracking) frame.
 *
 * Extracts target information including:
 * - Target number
 * - Range (scaled x100)
 * - Speed (scaled x100)
 * - Energy
 *
 * @param[in]  buf       Pointer to frame buffer.
 * @param[in]  len       Length of frame.
 * @param[in]  pos       Start position of "$DFDMD" marker.
 * @param[out] outTgt    Parsed target data structure.
 * @param[out] outExist  Indicates whether a valid target exists.
 *
 * @return true  If frame parsed successfully.
 * @return false If parsing fails.
 */
static bool c4001_parse_dfdmd( const uint8_t * const buf, 
                               size_t len, 
                               size_t pos, 
                               C4001Target * const outTgt,
                               bool * const outExist )
{
    bool result = false;
    
    if( ( buf != NULL ) && ( outTgt != NULL ) && ( outExist != NULL ) )
    {
        size_t fStart = 0;
        size_t fLen = 0;
        
        ( void ) memset( outTgt, 0, sizeof( C4001Target ) );
        *outExist = false;
        
        /* Parse 'number' field (Field 1) */
        result = str_ext_get_field( buf, len, pos, 1U, &fStart, &fLen );
        if( result && ( fLen > 0U ) )
        {
            long val = 0;
            if( str_ext_strtol( ( const char * ) &buf[ fStart ], fLen, &val ) )
            {
                outTgt->number = ( uint8_t ) val;
            }
            else
            {
                result = false;
            }
        }
        
        /* Parse 'range' field (Field 3) */
        if( result )
        {
            result = str_ext_get_field( buf, len, pos, 3U, &fStart, &fLen );
            if( result )
            {
                int32_t x100 = 0;
                result = str_ext_parse_x100( &buf[ fStart ], fLen, &x100 );
                if( result )
                {
                    outTgt->rangeM = x100;
                }
            }
        }
        
        /* Parse 'speed' field (Field 4) */
        if( result )
        {
            result = str_ext_get_field( buf, len, pos, 4U, &fStart, &fLen );
            if( result )
            {
                int32_t x100 = 0;
                result = str_ext_parse_x100( &buf[ fStart ], fLen, &x100 );
                if( result )
                {
                    outTgt->speedMs = x100;
                }
            }
        }
        
        /* Parse 'energy' field (Field 5) */
        if( result )
        {
            result = str_ext_get_field( buf, len, pos, 5U, &fStart, &fLen );
            if( result && ( fLen > 0U ) )
            {
                unsigned long val = 0;
                if( str_ext_strtoul( ( const char * ) &buf[ fStart ], fLen, &val ) )
                {
                    outTgt->energy = ( uint32_t ) val;
                }
                else
                {
                    result = false;
                }
            }
        }
        
        if( result )
        {
            *outExist = ( outTgt->number != 0U );
        }
    }
    
    return result;
}

/**
 * @brief Parse a C4001 data frame.
 *
 * Detects and processes supported frame types:
 * - $DFHPD (Presence Detection)
 * - $DFDMD (Target Tracking)
 *
 * Updates status information and extracts target data if present.
 *
 * @param[in]  buf        Pointer to received frame buffer.
 * @param[in]  len        Length of frame buffer.
 * @param[out] outStatus  Parsed sensor status.
 * @param[out] outExist   Indicates presence detection status.
 * @param[out] outTarget  Parsed target data.
 * @param[out] hasTarget  Indicates whether a valid target frame was parsed.
 *
 * @return true  If a valid and supported frame is parsed.
 * @return false If parsing fails or frame type unsupported.
 */
static bool c4001_parse_frame( const uint8_t * const buf,
                               size_t len,
                               C4001Status * const outStatus,
                               bool * const outExist,
                               C4001Target * const outTarget,
                               bool * const hasTarget )
{
    bool result = false;
    
    if( ( buf != NULL ) && ( outStatus != NULL ) && ( outExist != NULL ) && 
        ( outTarget != NULL ) && ( hasTarget != NULL ) )
    {
        ( void ) memset( outStatus, 0, sizeof( C4001Status ) );
        *outExist = false;
        ( void ) memset( outTarget, 0, sizeof( C4001Target ) );
        *hasTarget = false;
        
        const int startPos = str_ext_buf_find_char( buf, len, ( uint8_t ) '$' );
        
        if( startPos >= 0 )
        {
            const size_t pos = ( size_t ) startPos;
            
            /* Presence detection frame ($DFHPD) */
            if( ( pos < len ) && str_ext_starts_with( &buf[ pos ],
                                                      len - pos,
                                                      "$DFHPD",
                                                      6U ) )
            {
                outStatus->workMode = 0U;     /* ExistMode */
                outStatus->workStatus = 1U;
                outStatus->initStatus = 1U;
                
                /* Check exist bit at pos 7: "$DFHPD,x" */
                if( ( pos + 7U ) < len )
                {
                    if( ( buf[ pos + 7U ] == ( uint8_t ) '0' ) ||
                        ( buf[ pos + 7U ] == ( uint8_t ) '1' ) )
                    {
                        *outExist = ( buf[ pos + 7U ] == ( uint8_t ) '1' );
                        result = true;
                    }
                }
            }
            /* Target track frame ($DFDMD) */
            else if( ( pos < len ) && str_ext_starts_with( &buf[ pos ],
                                                           len - pos,
                                                           "$DFDMD",
                                                           6U ) )
            {
                outStatus->workMode = 1U;     /* SpeedMode */
                outStatus->workStatus = 1U;
                outStatus->initStatus = 1U;
                
                if( c4001_parse_dfdmd( buf, 
                                       len, 
                                       pos, 
                                       outTarget, 
                                       outExist ) )
                {
                    *hasTarget = true;
                    result = true;
                }
            }
            else
            {
                /* Unknown frame */
            }
        }
    }
    
    return result;
}
