#include "c4001.hpp"

#include <stddef.h>
#include <cstring>

#include "hal/c4001.h"
#include "utils/str/str_ext.h"
#include "utils/str/num_fmt.h"
#include "utils/time/delay.h"

namespace mmwave
{

    namespace
    {

        /* Command Strings */
        constexpr char kCmdStartSensor[]    { "sensorStart" };
        constexpr char kCmdStopSensor[]     { "sensorStop"  };
        constexpr char kCmdSaveConfig[]     { "saveConfig"  };
        constexpr char kCmdResetConfig[]    { "resetCfg"    };
        constexpr char kCmdResetSystem[]    { "resetSystem" };
        constexpr char kCmdExistMode[]      { "setRunApp 0" };
        constexpr char kCmdSpeedMode[]      { "setRunApp 1" };

        /* Query Commands */
        constexpr char kCmdGetSensitivity[] { "getSensitivity" };
        constexpr char kCmdGetLatency[]     { "getLatency"     };
        constexpr char kCmdGetRange[]       { "getRange"       };
        constexpr char kCmdGetTrigRange[]   { "getTrigRange"   };
        constexpr char kCmdGetThrFactor[]   { "getThrFactor"   };
        constexpr char kCmdGetMicroMotion[] { "getMicroMotion" };

        /* Buffer and Timeout Configuration */
        constexpr uint16_t kRxMaxBytes            { 256U  };
        constexpr uint16_t kCmdMaxBytes           { 64U   };
        constexpr uint32_t kUartReadTimeoutMs     { 200U  };
        constexpr uint8_t  kPollStartRetryCount   { 5U    };
        constexpr uint32_t kPollStartRetryDelayMs { 1000U };

        /* Range Validation Constants */
        constexpr uint16_t kRangeMinCm           { 30U   };
        constexpr uint16_t kRangeMaxCm           { 2000U };
        constexpr uint16_t kRangeMinMaxThreshold { 240U  };
        constexpr uint16_t kThrMax               { 2500U };
        constexpr uint8_t  kSensitivityMax       { 9U    };
        constexpr uint16_t kTrigDelayMax         { 200U  };
        constexpr uint16_t kKeepDelayMin         { 4U    };
        constexpr uint16_t kKeepDelayMax         { 3000U };
        constexpr uint8_t  kTargetFlashMax       { 10U   };

        /* Command and Sequence Delays */
        constexpr uint32_t kDelayAfterStartMs       { 200U  };
        constexpr uint32_t kDelayAfterStopMs        { 200U  };
        constexpr uint32_t kDelayAfterResetMs       { 1500U };
        constexpr uint32_t kDelayBeforeModeCmdMs    { 50U   };
        constexpr uint32_t kDelayAfterModeCmdMs     { 50U   };
        constexpr uint32_t kDelayBeforeSaveCfgMs    { 50U   };
        constexpr uint32_t kDelayAfterSaveCfgMs     { 500U  };
        constexpr uint32_t kDelayAfterConfigStartMs { 100U  };
        constexpr uint32_t kDelayAfterStopCmdMs     { 1000U };
        constexpr uint32_t kDelayAfterCmdMs         { 100U  };

        /* Command Prefixes with Lengths */
        constexpr char kSetRangePrefix[]              { "setRange " };
        constexpr size_t kSetRangePrefixLen           { sizeof(kSetRangePrefix) - 1U };

        constexpr char kSetTrigRangePrefix[]          { "setTrigRange " };
        constexpr size_t kSetTrigRangePrefixLen       { sizeof(kSetTrigRangePrefix) - 1U };

        constexpr char kSetTrigSensitivityPrefix[]    { "setSensitivity 255 " };
        constexpr size_t kSetTrigSensitivityPrefixLen { sizeof(kSetTrigSensitivityPrefix) - 1U };

        constexpr char kSetSensitivityPrefix[]        { "setSensitivity " };
        constexpr size_t kSetSensitivityPrefixLen     { sizeof(kSetSensitivityPrefix) - 1U };

        constexpr char kSetLatencyPrefix[]            { "setLatency " };
        constexpr size_t kSetLatencyPrefixLen         { sizeof(kSetLatencyPrefix) - 1U };

        constexpr char kSetThrPrefix[]                { "setThrFactor " };
        constexpr size_t kSetThrPrefixLen             { sizeof(kSetThrPrefix) - 1U };

        constexpr char kSetMicroMotionPrefix[]        {"setMicroMotion " };
        constexpr size_t kSetMicroMotionPrefixLen     { sizeof(kSetMicroMotionPrefix) - 1U };

    } /* anonymous namespace */

    bool C4001::connect()
    {
        bool result { false };

        uint8_t buf[ kRxMaxBytes ] {};
        int len { 0 };
        bool hasValidData { false };

        /* Flush and allow sensor to stream */
        c4001_hal_flush( &sensor_ );
        delay_ms( kDelayAfterStartMs );

        static_cast< void >( std::memset( buf, 0, sizeof( buf ) ) );

        len = c4001_hal_read( &sensor_,
                              buf,
                              sizeof( buf ) - 1U,
                              500U );

        if( len > 0 )
        {
            buf[ len ] = '\0';

            for( int i { 0 }; i < len; ++i )
            {
                if( ( buf[ i ] >= 32U ) && ( buf[ i ] < 127U ) )
                {
                    hasValidData = true;
                    break;
                }
            }

            if( hasValidData )
            {
                c4001_hal_flush( &sensor_ );

                if( writeCmd( kCmdStopSensor ) )
                {
                    delay_ms( kDelayAfterStopCmdMs );

                    static_cast< void >( std::memset( buf, 0, sizeof( buf ) ) );
                    len = c4001_hal_read( &sensor_,
                                          buf,
                                          sizeof( buf ) - 1U,
                                          1000U );

                    if( len > 0 )
                    {
                        buf[ len ] = '\0';

                        if( ( strstr( reinterpret_cast< const char * >( buf ), kCmdStopSensor ) != nullptr ) ||
                            ( strstr( reinterpret_cast< const char * >( buf ), "$DF" ) != nullptr ) )
                        {
                            static_cast< void >( sensorStop() );
                            result = true;
                        }
                    }
                }
            }
        }

        return result;
    }

    bool C4001::getStatus( Status & status )
    {
        bool result = false;

        uint8_t buf[ kRxMaxBytes ] {};
        int len { 0 };

        static_cast< void >( writeCmd( kCmdStartSensor ) );

        for( uint32_t attempt = 0U; attempt < kPollStartRetryCount; ++attempt )
        {
            len = c4001_hal_read( &sensor_,
                                  buf, 
                                  sizeof( buf ),
                                  kUartReadTimeoutMs ); 

            if( len > 0 )
            {
                bool exist { false };
                Target tgt {};
                bool hasTarget { false };

                if( parseFrame( buf, 
                                static_cast< size_t >( len ), 
                                status,
                                exist,
                                tgt,
                                hasTarget ) )
                {
                    result = true;
                    break;
                }
            }
            else
            {
                delay_ms( kPollStartRetryDelayMs );
            }
        }

        return result;
    }

    bool C4001::motionDetected( bool & motion )
    {
        bool result { false };

        uint8_t buf[ kRxMaxBytes ] {};
        int len { 0 };

        /* Initialize output */
        motion = lastExist_;
            
        len = c4001_hal_read( &sensor_, 
                              buf, 
                              sizeof( buf ), 
                              kUartReadTimeoutMs );

        if( len > 0 )
        {
            Status st {};
            bool exist { false };
            Target tgt {};
            bool hasTarget { false };

            if( parseFrame( buf,
                            static_cast< size_t >( len ),
                            st,
                            exist,
                            tgt,
                            hasTarget ) )
            {
                lastExist_ = exist;
                motion = exist;
                result = true;
            }
        }

        return result;
    }

    bool C4001::setSensorMode( Mode mode )
    {
        bool result { false };

        result = sensorStop();

        if( result )
        {
            if( mode == Mode::PRESENCE )
            {
                result = writeCmd( kCmdExistMode );
                delay_ms( kDelayAfterModeCmdMs ); 
            }
            else /* Mode::TRACKING */
            {
                result = writeCmd( kCmdSpeedMode );
                delay_ms( kDelayAfterModeCmdMs ); 
            }
        }

        if( result )
        {
            delay_ms( kDelayBeforeSaveCfgMs );
            result = writeCmd( kCmdSaveConfig );
            delay_ms( kDelayAfterSaveCfgMs );
        }

        if( result )
        {
            result = writeCmd( kCmdStartSensor );
            delay_ms( kDelayAfterConfigStartMs );
        }

        return result;
    }

    bool C4001::setTrigSensitivity( uint8_t sensitivity )
    {
        bool result { false };

        if( sensitivity <= kSensitivityMax )
        {
            char cmd[ kCmdMaxBytes ] {};

            const size_t len { kSetTrigSensitivityPrefixLen };

            /* Space for single digit + null terminator */
            if( ( len + 2U ) < sizeof( cmd ) )
            {
                /* Build "setSensitivity 255 <s>" */
                static_cast< void >( std::memcpy( cmd, kSetTrigSensitivityPrefix, 
                                                  kSetTrigSensitivityPrefixLen ) );
                cmd[ len ] = '0' + static_cast<char>( sensitivity );
                cmd[ len + 1U ] = '\0';

                result = cmdStopSaveStart( cmd, nullptr, 1U );
            }
        }

        return result;
    }

    bool C4001::getTrigSensitivity( uint8_t & sensitivity )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetSensitivity, 1U, response ) )
        {
            sensitivity = static_cast< uint8_t >( response.response1 );
            result = true;
        }

        return result;
    }

    bool C4001::setKeepSensitivity( uint8_t sensitivity )
    {
        bool result { false };

        if( sensitivity <= kSensitivityMax )
        {
            char cmd[ kCmdMaxBytes ] {};
            char * p { cmd };

            /* Build "setSensitivity <s> 255" */
            static_cast< void >( std::memcpy( p, kSetSensitivityPrefix,
                                              kSetSensitivityPrefixLen ) );
            p += kSetSensitivityPrefixLen;

            /* Sspace for " X 255\0" = 6 chars */
            const size_t remaining { sizeof( cmd ) - kSetSensitivityPrefixLen };
            if( remaining >= 6U )
            {
                *p++ = '0' + static_cast< char >( sensitivity );
                *p++ = ' ';
                *p++ = '2';
                *p++ = '5';
                *p++ = '5';
                *p = '\0';

                result = cmdStopSaveStart( cmd, nullptr, 1U );
            }
        }

        return result;
    }

    bool C4001::getKeepSensitivity( uint8_t & sensitivity )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetSensitivity, 2U, response ) )
        {
            sensitivity = static_cast< uint8_t >( response.response2 );
            result = true;
        }
        
        return result;
    }

    bool C4001::setDelay( uint8_t trig, uint16_t keep )
    {
        bool result { false };

        if( ( trig <= kTrigDelayMax ) &&
            ( keep >= kKeepDelayMin ) &&
            ( keep <= kKeepDelayMax ) )
        {
            char cmd[ kCmdMaxBytes ] {};
            char * p { cmd };

            /* Build "setLatency <trig*0.01> <keep*0.5>" */
            static_cast< void >( std::memcpy( p, kSetLatencyPrefix,
                                              kSetLatencyPrefixLen ) );
            p += kSetLatencyPrefixLen;

            /* Convert trig * 0.01 to tenths */
            p = num_fmt_append_fixed1( p, trig );
            *p++ = ' ';

            /* Convert keep * 0.5 to tenths */
            p = num_fmt_append_fixed1( p, keep * 5U );
            *p = '\0';
                
            result = cmdStopSaveStart( cmd, cmd, 1U );
        }
        
        return result;
    }

    bool C4001::getDelay( uint16_t & delayMs )
    {
        bool result { false };

        ResponseData response {};
            
        if( queryResponse( kCmdGetLatency, 1U, response ) )
        {
            /* Response is in seconds, convert to ms. */
            delayMs = static_cast< uint16_t >( response.response1 * 100.0f );
            result = true;
        }
        
        return result;
    }

    bool C4001::getKeepTimeout( uint16_t & timeoutMs )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetLatency, 2U, response ) )
        {
            /* Response is in seconds, convert to ms. */
            timeoutMs = static_cast< uint16_t >( response.response2 * 2.0f * 1000.0f );
            result = true;
        }
        
        return result;
    }

    bool C4001::setDetectionRange( uint16_t minCm,
                                   uint16_t maxCm,
                                   uint16_t trigCm )
    {
        bool result = false;

        if( ( maxCm >= kRangeMinMaxThreshold ) && 
            ( maxCm <= kRangeMaxCm ) &&
            ( minCm >= kRangeMinCm ) && 
            ( minCm <= maxCm ) )
        {
            char cmd1[ kCmdMaxBytes ] {};
            char cmd2[ kCmdMaxBytes ] {};
            char * p { nullptr };

            /* Convert cm to m with 1 decimal */
            const uint16_t minT  { static_cast< uint16_t >( ( minCm  + 5U ) / 10U ) };
            const uint16_t maxT  { static_cast< uint16_t >( ( maxCm  + 5U ) / 10U ) };
            const uint16_t trigT { static_cast< uint16_t >( ( trigCm + 5U ) / 10U ) };

            /* Build "setRange <min/10.0> <max/10.0>" */
            p = cmd1;
            static_cast< void >( std::memcpy( p, kSetRangePrefix,
                                                  kSetRangePrefixLen ) ); 
            p += kSetRangePrefixLen;
            p = num_fmt_append_fixed1( p, minT );
            *p++ = ' ';
            p = num_fmt_append_fixed1( p, maxT );
            *p = '\0';

            /* Build "setTrigRange <trig/10.0>" */
            p = cmd2;
            static_cast< void >( std::memcpy( p, kSetTrigRangePrefix, 
                                              kSetTrigRangePrefixLen ) );
            p += kSetTrigRangePrefixLen;
            p = num_fmt_append_fixed1( p, trigT );
            *p = '\0';

            result = cmdStopSaveStart( cmd1, cmd2, 2U );
        }

        return result;
    }

    bool C4001::getTrigRangeCm( uint16_t & trigCm )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetTrigRange, 1U, response ) )
        {
            /* Response is in meters, convert to cm. */
            trigCm = static_cast< uint16_t >( response.response1 * 100.0f );
            result = true;
        }

        return result;
    }

    bool C4001::getMinRangeCm( uint16_t & minCm )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetRange, 2U, response ) )
        {
            /* Response is in meters, convert to cm. */
            minCm = static_cast< uint16_t >( response.response1 * 100.0f );
            result = true;
        }

        return result;
    }

    bool C4001::getMaxRangeCm( uint16_t & maxCm )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetRange, 2U, response ) )
        {
            /* Response is in meters, convert to cm. */
            maxCm = static_cast< uint16_t >( response.response2 * 100.0f );
            result = true;
        }

        return result;
    }

    bool C4001::updateTarget( uint8_t & target )
    {
        bool result { false };

        uint8_t buf[ kRxMaxBytes ] {};
        int len { 0 };

        len = c4001_hal_read( &sensor_,
                              buf,
                              sizeof( buf ),
                              kUartReadTimeoutMs );
        if( len > 0 )
        {
            Status st {};
            bool exist { false };
            Target tgt {};
            bool hasTarget { false };

            if( parseFrame( buf,
                            static_cast< size_t >( len ), 
                            st,
                            exist,
                            tgt,
                            hasTarget ) &&
                hasTarget && ( tgt.count != 0U ) )
            {
                /* Valid target received */
                flashCount_ = 0U;
                cache_ = tgt;
            }
            else
            {
                /* No valid target */
                if( flashCount_ < 255U )
                {
                    flashCount_++;
                }

                if( flashCount_ > kTargetFlashMax )
                {
                    static_cast< void >( std::memset( &cache_, 0, sizeof( cache_ ) ) );
                    flashCount_ = 0U;
                }
            }
        }
        else
        {
            /* No data received */
            if( flashCount_ < 255U )
            {
                flashCount_++;
            }
                
            if( flashCount_ > kTargetFlashMax )
            {
                static_cast< void >( std::memset( &cache_, 0, sizeof( cache_ ) ) );
                flashCount_ = 0U;
            }
        }
        target = cache_.count;
        result = true;

        return result;
    }

    void C4001::getTarget( Target & target )
    {
        target = cache_;
    }

    bool C4001::setDetectThreshold( uint16_t minCm,
                                    uint16_t maxCm,
                                    uint16_t thres )
    {
        bool result { false };

        if( ( maxCm <= kThrMax ) &&
            ( minCm <= maxCm ) )
        {
            char cmd1[ kCmdMaxBytes ] {};
            char cmd2[ kCmdMaxBytes ] {};
            char * p { nullptr };

            /* Convert cm to m with 1 decimal */
            const uint16_t minT { static_cast< uint16_t >( ( minCm + 5U ) / 10U ) };
            const uint16_t maxT { static_cast< uint16_t >( ( maxCm + 5U ) / 10U ) };

            /* Build "setRange <min/10.0> <max/10.0>" */
            p = cmd1;
            static_cast< void >( std::memcpy( p, kSetRangePrefix, 
                                              kSetRangePrefixLen ) );
            p += kSetRangePrefixLen;
            p = num_fmt_append_fixed1( p, minT );
            *p++ = ' ';
            p = num_fmt_append_fixed1( p, maxT );
            *p = '\0';

            /* Build "setThrFactor <thres>" */
            p = cmd2;
            static_cast< void >( std::memcpy( p, kSetThrPrefix, 
                                              kSetThrPrefixLen ) );
            p += kSetThrPrefixLen;
            p = num_fmt_append_u16( p, thres );
            *p = '\0';

            result = cmdStopSaveStart( cmd1, cmd2, 2U );
        }
        
        return result;
    }

    bool C4001::getThreshold( uint16_t & threshold )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetThrFactor, 1U, response ) )
        {
            threshold = static_cast< uint16_t >( response.response1 );
            result = true;
        }

        return result;
    }

    bool C4001::setMicroMotion( bool enable )
    {
        bool result { false };

        char cmd[ kCmdMaxBytes ] {};
        char * p { cmd };

        /* Build "setMicroMotion <st>" */
        static_cast< void >( std::memcpy( p, kSetMicroMotionPrefix,
                                          kSetMicroMotionPrefixLen ) );
        p += kSetMicroMotionPrefixLen;
        p = num_fmt_append_u16( p, static_cast< uint16_t >( enable ) );
        *p = '\0';
        result = cmdStopSaveStart( cmd, cmd, 1U );

        return result;
    }

    bool C4001::getMicroMotion( bool & isEnabled )
    {
        bool result { false };

        ResponseData response {};

        if( queryResponse( kCmdGetMicroMotion, 1U, response ) )
        {
            isEnabled = ( response.response1 != 0.0f );
            result = true;
        }
        
        return result;
    }

    bool C4001::setPwm( uint8_t pwm1,
                        uint8_t pwm2,
                        uint8_t timer )
    {
        bool result { false };

        if( ( pwm1 <= 100U ) && ( pwm2 <= 100U ) )
        {

        }

        return result;
    }

    bool C4001::setGpioPolarity( uint8_t value )
    {
        bool result { false };

        return result;
    }

    bool C4001::writeCmd( const char * const cmd )
    {
        bool result { false };

        if( cmd != nullptr )
        {
            const size_t len { strlen( cmd ) };
            if( len > 0U )
            {
                if( c4001_hal_write( &sensor_,
                                     reinterpret_cast< const uint8_t * >( cmd ),
                                     len ) )
                {
                    result = true;
                }
            }
        }
        
        return result;
    }

    bool C4001::sensorStop()
    {
        bool result { false };

        delay_ms( 1200U );
        if( writeCmd( kCmdStopSensor ) )
        {
            uint8_t buf[ kRxMaxBytes ] {};
            int len { 0 };

            /* Wait for sensor to react */
            delay_ms( 600U );

            /* Read ACK */
            len = c4001_hal_read( &sensor_,
                                  buf,
                                  sizeof( buf ) - 1,
                                  500U );

            if( len > 0 )
            {
                buf[ len ] = '\0';

                /* Accept silence or ACK */
                if( strstr( reinterpret_cast< const char * >( buf ), kCmdStopSensor ) ||
                    strstr( reinterpret_cast< const char * >( buf ), "$DF" ) )
                {
                    result = true;
                }
            }
        }

        return result;
    }

    bool C4001::cmdStopSaveStart( const char * const cmd1, 
                                  const char * const cmd2, 
                                  uint8_t count )
    {
        bool result { false };

        if( cmd1 != nullptr )
        {
            result = sensorStop();

            /* Write first command */
            if( result )
            {
                result = writeCmd( cmd1 );
                delay_ms( kDelayAfterCmdMs );
            }

            /* Write optional second command */
            if( result && ( count > 1U ) && ( cmd2 != nullptr ) )
            {
                delay_ms( kDelayAfterCmdMs );
                result = writeCmd( cmd2 );
                delay_ms( kDelayAfterCmdMs );
            }

            /* Save configuration */
            if( result )
            {
                result = writeCmd( kCmdSaveConfig );
                delay_ms( kDelayAfterCmdMs );
            }

            /* Start sensor */
            if( result )
            {
                result = writeCmd( kCmdStartSensor );
                delay_ms( kDelayAfterCmdMs );
            }
        }

        return result;
    }

    bool C4001::queryResponse( const char * const cmd,
                               uint8_t expectedResponses,
                               ResponseData & data )
    {
        bool result { false };

        if( cmd != nullptr )
        {
            uint8_t buf[ kRxMaxBytes ] {};
            int len { 0 };

            static_cast< void >( std::memset( &data, 0, sizeof( ResponseData ) ) );
            static_cast< void >( std::memset( buf, 0, sizeof( buf ) ) );

            if( sensorStop() )
            {
                if( writeCmd( cmd ) )
                {
                    delay_ms( kDelayAfterCmdMs );

                    len = c4001_hal_read( &sensor_,
                                          buf,
                                          sizeof( buf ),
                                          kUartReadTimeoutMs );
                    if( len > 0 )
                    {
                        result = parseResponse( buf, 
                                                static_cast<size_t>( len ), 
                                                expectedResponses, 
                                                data );
                    }

                    delay_ms( kDelayAfterCmdMs );
                }

                static_cast< void >( writeCmd( kCmdStartSensor ) );
                delay_ms( kDelayAfterCmdMs );
            }
        }

        return result;
    }

    bool C4001::parseResponse( const uint8_t * const buf,
                               size_t len,
                               uint8_t count,
                               ResponseData & data )
    {
        bool result { false };

        if( ( buf != nullptr ) )
        {
            size_t i { 0U };
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
                data.status = true;

                /* Find space-separated values after "Res" */
                uint8_t spacePositions[ 4 ] {};
                uint8_t spaceCount { 0 };

                for( size_t j { i }; j < len && spaceCount < 4U; ++j )
                {
                    if( buf[ j ] == ' ' )
                    {
                        spacePositions[ spaceCount++ ] = static_cast< uint8_t >( j + 1U );
                    }
                }

                if( spaceCount > 0U )
                {
                    /* Parse first value */
                    char tmp[ 32 ] {};
                    size_t valStart { spacePositions[ 0 ] };
                    size_t valLen { 0 };

                    /* Find length of first value */
                    for( size_t k { valStart }; k < len; ++k )
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
                        static_cast< void >( std::memcpy( tmp, &buf[ valStart ], valLen ) );
                        tmp[ valLen ] = '\0';
                        data.response1 = static_cast< float >( atof( tmp ) );
                    }

                    /* Parse second value if expected */
                    if( ( count >= 2U ) && ( spaceCount >= 2U ) )
                    {
                        valStart = spacePositions[ 1 ];
                        valLen = 0;

                        for( size_t k { valStart }; k < len; ++k )
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
                            static_cast< void >( std::memcpy( tmp, &buf[ valStart ], valLen ) );
                            tmp[ valLen ] = '\0';
                            data.response2 = static_cast< float >( atof( tmp ) );
                        }
                    }

                    /* Parse third value if expected */
                    if( ( count >= 3U ) && ( spaceCount >= 3U ) )
                    {
                        valStart = spacePositions[ 2 ];
                        valLen = 0;

                        for( size_t k { valStart }; k < len; ++k )
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
                            static_cast< void >( std::memcpy( tmp, &buf[ valStart ], valLen ) );
                            tmp[ valLen ] = '\0';
                            data.response3 = static_cast< float >( atof( tmp ) );
                        }
                    }

                    result = true;
                }
            }
            else
            {
                /* No response marker found */
                data.status = false;
            }
        }

        return result;
    }

    bool C4001::parseDfdmd( const uint8_t * const buf,
                            size_t len,
                            size_t pos,
                            Target & target,
                            bool & exist )
    {
        bool result { false };

        if( buf != nullptr )
        {
            size_t fStart { 0 };
            size_t fLen { 0 };

            static_cast< void >( std::memset( &target, 0, sizeof( Target ) ) );
            exist = false;

            /* Parse 'number' field (Field 1) */
            result = str_ext_get_field( buf, len, pos, 1U, &fStart, &fLen );
            if( result && ( fLen > 0U ) )
            {
                long val { 0 };
                if( str_ext_strtol( reinterpret_cast< const char * >( &buf[ fStart ] ), fLen, &val ) )
                {
                    target.count = static_cast<uint8_t>( val );
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
                        target.distanceM = x100;
                    }
                }
            }

            /* Parse 'speed' field (Field 4) */
            if( result )
            {
                result = str_ext_get_field( buf, len, pos, 4U, &fStart, &fLen );
                if( result )
                {
                    int32_t x100 { 0 };
                    result = str_ext_parse_x100( &buf[ fStart ], fLen, &x100 );
                    if( result )
                    {
                        target.velocityMs = x100;
                    }
                }
            }

            /* Parse 'energy' field (Field 5) */
            if( result )
            {
                result = str_ext_get_field( buf, len, pos, 5U, &fStart, &fLen );
                if( result && ( fLen > 0U ) )
                {
                    unsigned long val { 0 };
                    if( str_ext_strtoul( reinterpret_cast<const char *>( &buf[ fStart ] ), fLen, &val ) )
                    {
                        target.signalStrength = static_cast< uint32_t >( val );
                    }
                    else
                    {
                        result = false;
                    }
                }
            }

            if( result )
            {
                exist = ( target.count != 0U );
            }
        }

        return result;
    }

    bool C4001::parseFrame( const uint8_t * const buf,
                            size_t len,
                            Status & status,
                            bool & exist,
                            Target & target,
                            bool & hasTarget )
    {
        bool result { false };
        
        if( buf != nullptr )
        {
            static_cast< void >( std::memset( &status, 0, sizeof( Status ) ) );
            exist = false;
            static_cast< void >( std::memset( &target, 0, sizeof( Target ) ) );
            hasTarget = false;
            
            const int startPos { str_ext_buf_find_char( buf, len,
                                                        static_cast< uint8_t >( '$' ) ) };
            if( startPos >= 0 )
            {
                const size_t pos { static_cast< size_t >( startPos ) };

                /* Presence detection frame ($DFHPD) */
                if( ( pos < len ) && str_ext_starts_with( &buf[ pos ],
                                                          len - pos,
                                                          "$DFHPD",
                                                          6U ) )
                {
                    status.activeMode = static_cast< Mode >( 0U ); /* ExistMode */
                    status.isRunning = true;
                    status.isInitialized = true;

                    /* Check exist bit at pos 7: "$DFHPD,x" */
                    if( ( pos + 7U ) < len )
                    {
                        if( ( buf[ pos + 7U ] == static_cast< uint8_t >( '0' ) ) ||
                            ( buf[ pos + 7U ] == static_cast< uint8_t >( '1' ) ) )
                        {
                            exist = ( buf[ pos + 7U ] == static_cast< uint8_t >( '1' ) );
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
                    status.activeMode = static_cast< Mode >( 1U ); /* SpeedMode */
                    status.isRunning = true;
                    status.isInitialized = true;

                    if( parseDfdmd( buf, 
                                    len, 
                                    pos, 
                                    target, 
                                    exist ) )
                    {
                        hasTarget = true;
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

} /* namespace mmwave */
