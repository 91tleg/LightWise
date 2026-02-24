#include "lwnode.hpp"
#include <cstring>

#include "utils/num_fmt.h"
#include "utils/str_ext.h"
#include "hal/lwnode.h"

namespace lorawan
{
    namespace
    {
        /* Registers */
        constexpr uint8_t kRegWriteAtLong    = 0x39U;
        constexpr uint8_t kRegWriteAt        = 0x40U;
        constexpr uint8_t kRegReadAtLen      = 0x41U;
        constexpr uint8_t kRegReadAt         = 0x42U;
        constexpr uint8_t kRegReadAtLong     = 0x43U;
        constexpr uint8_t kRegReadData       = 0x45U;
        constexpr uint8_t kRegReadNumQueue   = 0x46U;
        constexpr uint8_t kRegReadDataLen    = 0x47U;
        constexpr uint8_t kRegReadNextData   = 0x48U;

        /* I2C */
        constexpr uint8_t  kI2cChunkSize          = 30U;
        constexpr uint32_t kI2cChunkDelayMs       = 100U;
        constexpr uint8_t  kMaxLoRaPayloadLen     = 128U;
        constexpr uint32_t kReadDataDelayMs       = 100U;

        /* AT Timing */
        constexpr uint32_t kAtPostWriteDelayMs = 800U;
        constexpr uint32_t kAtAckPollDelayMs   = 1U;
        constexpr uint32_t kAtAckTimeoutLoops  = 250U;
        constexpr uint32_t kBeginRetryCount    = 100U;

        /* RX metadata */
        constexpr uint8_t kLorawanRxMetadataOffset = 9U;
        constexpr uint8_t kRssiIndex = 6U;
        constexpr uint8_t kSnrIndex  = 7U;
        constexpr int8_t  kSnrOffset = 50;

        /* +RECV frame layout */
        constexpr uint8_t kRecvRssiOffset     = 0U;
        constexpr uint8_t kRecvSnrOffset      = 1U;
        constexpr uint8_t kRecvPayloadLenOff  = 2U;
        constexpr uint8_t kRecvHeaderSize     = 3U;

        constexpr uint8_t kSnrNormFactor      = 50U;

        /* Buffer */
        constexpr size_t kAtAckMaxLen = 64U;
        constexpr size_t kAtCmdMaxLen = 520U;

        /* AppEUI */
        constexpr char kAppEuiPrefix[]      = "AT+JOINEUI=";
        constexpr size_t kAppEuiPrefixLen   = sizeof( kAppEuiPrefix ) - 1U;
        constexpr size_t kAppEuiCmdLen      = kAppEuiPrefixLen + LorawanSensor::kAppEuiHexChars;

        /* AppKey */
        constexpr char kAppKeyPrefix[]     = "AT+APPKEY=";
        constexpr size_t kAppKeyPrefixLen  = sizeof( kAppKeyPrefix ) - 1U;
        constexpr size_t kAppKeyCmdLen     = kAppKeyPrefixLen + LorawanSensor::kAppKeyHexChars;

        /* NwkSKey */
        constexpr char kNwkSKeyPrefix[]    = "AT+NWKSKEY=";
        constexpr size_t kNwkSKeyPrefixLen = sizeof( kNwkSKeyPrefix ) - 1U;
        constexpr size_t kNwkSKeyCmdLen    = kNwkSKeyPrefixLen + LorawanSensor::kNwkSKeyHexChars;

        /* AppSKey */
        constexpr char kAppSKeyPrefix[]    = "AT+APPSKEY=";
        constexpr size_t kAppSKeyPrefixLen = sizeof( kAppSKeyPrefix ) - 1U;
        constexpr size_t kAppSKeyCmdLen    = kAppSKeyPrefixLen + LorawanSensor::kAppSKeyHexChars;

        /* RECV */
        constexpr char kRecvPrefix[]       = "+RECV=";
        constexpr size_t kRecvPrefixLen    = sizeof( kRecvPrefix ) - 1U;

        /* DevAddr */
        constexpr char kDevAddrPrefix[]    = "AT+DEVADDR=";
        constexpr size_t kDevAddrPrefixLen = sizeof( kDevAddrPrefix ) - 1U;
        constexpr size_t kDevAddrHexLen    = 8U;
        constexpr size_t kDevAddrCmdLen    = kDevAddrPrefixLen + kDevAddrHexLen;

        /* DataRate */
        constexpr char kDataRatePrefix[]      = "AT+DATARATE=";
        constexpr size_t kDataRatePrefixLen   = sizeof( kDataRatePrefix ) - 1U;
        constexpr size_t kDataRateMaxDecChars = 3U;  /* 0-255 */
        constexpr size_t kDataRateCmdLen      = kDataRatePrefixLen + kDataRateMaxDecChars;

        /* EIRP */
        constexpr char kEirpPrefix[]          = "AT+EIRP=";
        constexpr size_t kEirpPrefixLen       = sizeof( kEirpPrefix ) - 1U;
        constexpr size_t kEirpMaxDecChars     = 3U;
        constexpr size_t kEirpCmdLen          = kEirpPrefixLen + kEirpMaxDecChars;

        /* SubBand */
        constexpr char kSubbandPrefix[]       = "AT+SUBBAND=";
        constexpr size_t kSubbandPrefixLen    = sizeof( kSubbandPrefix ) - 1U;
        constexpr size_t kSubbandMaxDecChars  = 3U;
        constexpr size_t kSubbandCmdLen       = kSubbandPrefixLen + kSubbandMaxDecChars;

        /* ADR */
        constexpr char kAdrPrefix[]           = "AT+ADR=";
        constexpr size_t kAdrPrefixLen        = sizeof( kAdrPrefix ) - 1U;
        constexpr size_t kAdrValLen           = 1U;
        constexpr size_t kAdrCmdLen           = kAdrPrefixLen + kAdrValLen;

        /* SEND */
        constexpr char kSendPrefix[]          = "AT+SEND=";
        constexpr size_t kSendPrefixLen       = sizeof( kSendPrefix ) - 1U;
    } /* anonymous namespace */

    bool Lwnode::init()
    {
        bool result = false;

        if( sensor_ != nullptr )
        {
            isInitialized_ = true;
            result = true;
        }
        return result;
    }

    bool Lwnode::setRxCb( RxCallback callback )
    {
        bool result = false;

        if( isInitialized_ && ( callback != nullptr ) )
        {
            rxCb_ = callback;
            result = true;
        }

        return result;
    }

    int8_t Lwnode::lastRssi()
    {
        int8_t lastRssi = 0;

        if( isInitialized_ )
        {
            lastRssi = lastRssi_;
        }

        return lastRssi;
    }

    int8_t Lwnode::lastSnr()
    {
        int8_t lastSnr = 0;

        if( isInitialized_ )
        {
            lastSnr = lastSnr_;
        }

        return lastSnr;
    }

    bool Lwnode::configOtaa()
    {
        bool result = false;

        if( isInitialized_ )
        {
            joinMode_ = JoinMode::OTAA;
            result = true;
        }

        return result;
    }

    bool Lwnode::configAbp()
    {
        bool result = false;

        if( isInitialized_ )
        {
            joinMode_ = JoinMode::ABP;
            result = true;
        }

        return result;
    }

    bool Lwnode::setRegion( Region region )
    {
        bool result = false;

        if( isInitialized_ )
        {
            char ack[ kAtAckMaxLen ] = {};
            const char * cmd = nullptr;

            switch( region )
            {
                case Region::EU868: 
                    cmd = "AT+REGION=EU868"; 
                    break;
                case Region::US915:
                    cmd = "AT+REGION=US915"; 
                    break;
                case Region::CN470:
                    cmd = "AT+REGION=CN470"; 
                    break;
                default:
                    /* Invalid region */
                    break;
            }

            if( cmd != nullptr )
            {
                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+REGION=OK\r\n" ) )
                    {
                        region_ = region;
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setAppEui( const char * const joinEuiHex16 )
    {
        bool result = false;

        if( isInitialized_ && ( joinEuiHex16 != nullptr ) )
        {
            const size_t n = str_ext_strnlen( joinEuiHex16, 
                                              kAppEuiHexChars + 1U );
            if( n == kAppEuiHexChars )
            {
                char cmd[ kAppEuiCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                ( void ) memcpy( appEui_,
                                 joinEuiHex16,
                                 kAppEuiHexChars );
                appEui_[ kAppEuiHexChars ] = '\0';

                str_ext_to_upper_case( appEui_ );

                ( void ) memcpy( cmd, 
                                 kAppEuiPrefix,
                                 kAppEuiPrefixLen );
                ( void ) memcpy( &cmd[ kAppEuiPrefixLen ], 
                                 appEui_,
                                 kAppEuiHexChars );
                cmd[ kAppEuiCmdLen - 1U ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+JOINEUI=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setAppKey( const char * const appKeyHex32 )
    {
        bool result = false;

        if( isInitialized_ && ( appKeyHex32 != nullptr ) )
        {
            const size_t n = str_ext_strnlen( appKeyHex32,
                                              kAppKeyHexChars + 1U );
            if( n == kAppKeyHexChars )
            {
                char cmd[ kAppKeyCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                ( void ) memcpy( appKey_,
                                 appKeyHex32,
                                 kAppKeyHexChars );
                appKey_[ kAppKeyHexChars ] = '\0';
                str_ext_to_upper_case( appKey_ );

                ( void ) memcpy( cmd,
                                 kAppKeyPrefix,
                                 kAppKeyPrefixLen );
                ( void ) memcpy( &cmd[ kAppKeyPrefixLen ], 
                                 appKey_, 
                                 kAppKeyHexChars );
                cmd[ kAppKeyCmdLen - 1U ] = '\0' ;

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+APPKEY=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }
            
        return result;
    }

    bool Lwnode::setNwkSkey( const char * const nwkSkeyHex32 )
    {
        bool result = false;

        if( isInitialized_ && ( nwkSkeyHex32 != nullptr ) )
        {
            const size_t n = str_ext_strnlen( nwkSkeyHex32, 
                                              kNwkSKeyHexChars + 1U );
            if( n == kNwkSKeyHexChars )
            {
                char cmd[ kNwkSKeyCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                ( void ) memcpy( nwkSkey_, 
                                 nwkSkeyHex32, 
                                 kNwkSKeyHexChars );
                nwkSkey_[ kNwkSKeyHexChars ] = '\0';
                str_ext_to_upper_case( nwkSkey_ );

                ( void ) memcpy( cmd, 
                                 kNwkSKeyPrefix,
                                 kNwkSKeyPrefixLen );
                ( void ) memcpy( &cmd[ kNwkSKeyPrefixLen ], 
                                 nwkSkey_, 
                                 kNwkSKeyHexChars );
                cmd[ kNwkSKeyCmdLen - 1U ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+NWKSKEY=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setAppSkey( const char * const appSkeyHex32 )
    {
        bool result = false;

        if( isInitialized_ && ( appSkeyHex32 != nullptr ) )
        {
            const size_t n = str_ext_strnlen( appSkeyHex32,
                                              kAppSKeyHexChars + 1U );
            if( n == kAppSKeyHexChars )
            {
                char cmd[ kAppSKeyCmdLen ]{};
                char ack[ kAtCmdMaxLen ]{};

                ( void ) memcpy( appSkey_, 
                                 appSkeyHex32, 
                                 kAppSKeyHexChars );
                appSkey_[ kAppSKeyHexChars ] = '\0';
                str_ext_to_upper_case( appSkey_ );

                ( void ) memcpy( cmd,
                                 kAppSKeyPrefix,
                                 kAppSKeyPrefixLen );
                ( void ) memcpy( &cmd[ kAppSKeyPrefixLen ],
                                 appSkey_,
                                 kAppSKeyHexChars );
                cmd[ kAppSKeyCmdLen - 1U ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+APPSKEY=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }
        
        return result;
    }

    bool Lwnode::setDevAddr( uint32_t devAddr )
    {
        bool result = false;

        if( isInitialized_ )
        {   
            char hexAddr[ 9 ]{};

            if( num_fmt_u32_to_hex8( devAddr, hexAddr, sizeof( hexAddr ) ) )
            {
                char cmd[ kDevAddrCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                ( void ) memcpy( cmd,
                                 kDevAddrPrefix,
                                 kDevAddrPrefixLen );
                ( void ) memcpy( &cmd[ kDevAddrPrefixLen ],
                                 hexAddr,
                                 kDevAddrHexLen );
                cmd[ kDevAddrCmdLen - 1U ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+DEVADDR=OK\r\n" ) )
                    {
                        devAddr_ = devAddr;
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setClass( DeviceClass classType )
    {
        bool result = false;

        if( isInitialized_ )
        {
            char ack[ kAtAckMaxLen ]{};
            const char * cmd = nullptr;

            switch( classType )
            {
                case DeviceClass::A:
                    cmd = "AT+CLASS=CLASS_A";
                    break;
                case DeviceClass::C:
                    cmd = "AT+CLASS=CLASS_C";
                    break;
                default: 
                    /* Invalid class */
                    break;

            }

            if( cmd != nullptr )
            {
                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+CLASS=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setDatarate( uint8_t dataRate )
    {
        bool result = false;

        if( isInitialized_ )
        {

            char dataRateStr[ kDataRateMaxDecChars + 1U ];

            if( num_fmt_u8toa( dataRate, dataRateStr, sizeof( dataRateStr ) ) )
            {
                char cmd[ kDataRateCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                const size_t len = str_ext_strnlen( dataRateStr, sizeof( dataRateStr ) );

                ( void ) memcpy( cmd,
                                 kDataRatePrefix,
                                 kDataRatePrefixLen );

                ( void ) memcpy( &cmd[ kDataRatePrefixLen ],
                                 dataRateStr,
                                 len );

                cmd[ kDataRatePrefixLen + len ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+DATARATE=OK\r\n" ) )
                    {
                        dataRate_ = dataRate;
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setEirp( uint8_t eirp )
    {
        bool result = false;

        if( isInitialized_ )
        {
            char numStr[ kEirpMaxDecChars + 1U ];

            if( num_fmt_u8toa( eirp, numStr, sizeof( numStr ) ) )
            {
                char cmd[ kEirpCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                const size_t len = str_ext_strnlen( numStr, sizeof( numStr ) );

                ( void ) memcpy( cmd, 
                                 kEirpPrefix, 
                                 kEirpPrefixLen );

                ( void ) memcpy( &cmd[ kEirpPrefixLen ], 
                                 numStr, 
                                 len );

                cmd[ kEirpPrefixLen + len ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+EIRP=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::setSubband( uint8_t subBand )
    {
        bool result = false;

        if( isInitialized_ && ( region_ != Region::EU868 ) )
        {
            char numStr[ kSubbandMaxDecChars + 1U ];

            if( num_fmt_u8toa( subBand, numStr, sizeof( numStr ) ) )
            {
                char cmd[ kSubbandCmdLen ]{};
                char ack[ kAtAckMaxLen ]{};

                const size_t len = str_ext_strnlen( numStr, sizeof( numStr ) );

                ( void ) memcpy( cmd, 
                                 kSubbandPrefix, 
                                 kSubbandPrefixLen );

                ( void ) memcpy( &cmd[ kSubbandPrefixLen ], 
                                 numStr, 
                                 len );

                cmd[ kSubbandPrefixLen + len ] = '\0';

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+SUBBAND=OK\r\n" ) )
                    {
                        subBand_ = subBand;
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::enableAdr( bool adr )
    {
        bool result = false;

        if( isInitialized_ )
        {
            char cmd[ kAdrCmdLen ]{};
            char ack[ kAtAckMaxLen ]{};

            /* 1. Build Command: "AT+ADR=" + '0' or '1' */
            ( void ) memcpy( cmd, kAdrPrefix, kAdrPrefixLen );

            cmd[ kAdrPrefixLen ] = ( adr ? '1' : '0' );
            cmd[ kAdrPrefixLen + 1U ] = '\0';

            if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
            {
                if( ackEquals( ack, "+ADR=OK\r\n" ) )
                {
                    adr_ = adr;
                    result = true;
                }
            }
        }

        return result;
    }

    bool Lwnode::setPacketType( PacketType type)
    {
        bool result = false;
    
        if( isInitialized_ )
        {
            const char * cmd = nullptr;

            switch( type )
            {
                case PacketType::UNCONFIRMED:
                    cmd = "AT+UPLINKTYPE=UNCONFIRMED";
                    break;
                case PacketType::CONFIRMED:
                    cmd = "AT+UPLINKTYPE=CONFIRMED"; 
                    break;
                default:
                    /* Invalid type */
                    break;
            }
            
            if( cmd != nullptr )
            {
                char ack[ kAtAckMaxLen ]{};

                if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                {
                    if( ackEquals( ack, "+UPLINKTYPE=OK\r\n") )
                    {
                        result = true;
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::begin()
    {
        bool result = false;

        if( isInitialized_ && ( sensor_ != nullptr ) )
        {    
            char ack[ kAtAckMaxLen ]{};
            uint8_t retry = kBeginRetryCount;

            result = sendAtCmd( "AT+REBOOT", ack, sizeof( ack ) );
            lwnode_hal_delay_ms( 100U );

            if( result )
            {
                /* AT Test */
                while( retry > 0U )
                {
                    if( atTest() )
                    {
                        result = true;
                        break;
                    }
                    retry--;
                    lwnode_hal_delay_ms( 10U );
                }
            }

            if( result )
            {
                /* Enable receive queue */
                result = sendAtCmd( "AT+RECV=1", ack, sizeof( ack ) );
            }

            if( result )
            {
                /* Set mode to LoRaWAN: OTAA and ABP */
                result = sendAtCmd( "AT+LORAMODE=LORAWAN", ack, sizeof( ack ) );
            }

            /* Join Type Specific Configuration */
            if( result )
            {
                if( joinMode_ == JoinMode::ABP )
                {
                    result = sendAtCmd( "AT+JOINTYPE=ABP", ack, sizeof( ack ) );
                    result = result && ackEquals( ack, "+JOINTYPE=OK\r\n" );

                    if( result && ( nwkSkey_[ 0 ] != '\0' ) )
                    {
                        result = setNwkSkey( nwkSkey_ );
                    }
                    if( result && ( appSkey_[ 0 ] != '\0' ) )
                    {
                        result = setAppSkey( appSkey_ );
                    }
                    if( result && ( devAddr_ != 0U ) )
                    {
                        result = setDevAddr( devAddr_ );
                    }
                }
                else /* LWNODE_JOIN_OTAA */
                {
                    result = sendAtCmd( "AT+JOINTYPE=OTAA", ack, sizeof( ack ) );
                    result = result && ackEquals( ack, "+JOINTYPE=OK\r\n" );

                    if( result && ( appEui_[ 0 ] != '\0' ) )
                    {
                        result = setAppEui( appEui_ );
                    }
                    if( result && ( appKey_[ 0 ] != '\0' ) )
                    {
                        result = setAppKey( appKey_ );
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::join()
    {
        bool result = false;

        if( isInitialized_ )
        {
            char ack[ kAtAckMaxLen ]{};
            if( sendAtCmd( "AT+JOIN=1", ack, sizeof( ack ) ))
            {
                if( ackEquals( ack, "+JOIN=OK\r\n") )
                {
                    result = true;
                }
            }
        }

        return result;
    }

    bool Lwnode::isJoined()
    {
        bool result = false;
        
        if( isInitialized_ )
        {
            char ack[ kAtAckMaxLen ]{};
            if( sendAtCmd( "AT+JOIN?", ack, sizeof( ack ) ) )
            {
                if( ackEquals(ack, "+JOIN=1\r\n") )
                {
                    result = true;
                }
            }
        }

        return result;
    }

    bool Lwnode::sendPacket( const uint8_t * const data, 
                             uint8_t len )
    {
        bool result = false;

        if( isInitialized_ && ( data != nullptr ) && ( len > 0U ) )
        {    
            char hex[ ( kMaxRxBytes * 2U ) + 1U ]{};
            
            /* Hex encode the raw bytes into ASCII hex */
            if( num_fmt_hex_encode( data, len, hex, sizeof( hex ) ) )
            {
                char cmd[ kAtCmdMaxLen ]{};

                const size_t hexLen = str_ext_strnlen( hex, sizeof( hex ) );
            
                ( void ) memcpy( cmd, kSendPrefix, kSendPrefixLen );

                if( ( 8U + hexLen ) < sizeof( cmd ) )
                {
                    char ack[ kAtAckMaxLen ]{};
                    ( void ) strncat( cmd, hex, sizeof( cmd ) - 9U );

                    if( sendAtCmd( cmd, ack, sizeof( ack ) ) )
                    {
                        if( ackEquals( ack, "+SEND=OK\r\n" ) || 
                            ackEquals( ack, "AT+SEND=OK\r\n" ) ||
                            ackEquals( ack, "+SEND=QUEUE\r\n" ) /* Success?? */ )
                        {
                            result = true;
                        }
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::sleepMs( uint32_t ms )
    {
        bool result = false;

        if( isInitialized_ )
        {
            uint32_t t = 0U;
            uint16_t rxLen = 0U;

            while (t < ms)
            {
                /* If no callbacks registered, just delay in bounded steps */
                if( rxCb_ == nullptr )
                {
                    uint32_t remaining = ms - t;
                    uint32_t step = ( remaining > 100U ) ? 100U : remaining;
                    lwnode_hal_delay_ms( step );
                    t += step;
                    continue;
                }

                /* Poll for queued data */
                if( readLoraData( &rxLen ) )
                {
                    ( void ) processRecvFrames( rxBuf_, rxLen );
                }

                lwnode_hal_delay_ms( 1U );
                t += 1U;
            }
            result = true;
        }

        return result;
    }

    bool Lwnode::readData( uint8_t * const out, 
                           uint16_t outMax, 
                           uint16_t * const outLen )
    {
        bool result = false;
        
        if( isInitialized_ && ( out != nullptr ) && ( outLen != nullptr ) && ( outMax != 0U ) )
        {
            uint16_t rxLen = 0U;
            *outLen = 0U;

            if( readLoraData( &rxLen ) )
            {
                /* LoRaWAN frame validation (must exceed metadata header) */
                if( rxLen > static_cast<uint16_t>( kLorawanRxMetadataOffset ) )
                {
                    /* Extract Metadata (RSSI/SNR) */
                    lastRssi_ = -( static_cast<int8_t>( rxBuf_[ kRssiIndex ] ) );
                    lastSnr_  = static_cast<int8_t>( rxBuf_[ kSnrIndex ] - kSnrOffset );

                    /* Calculate payload size and apply bounds checking */
                    rxLen = ( rxLen - static_cast<uint16_t>( kLorawanRxMetadataOffset ) );
                    
                    if( rxLen > outMax )
                    {
                        rxLen = outMax;
                    }

                    /* Copy payload and update output length */
                    ( void ) memcpy( out, 
                                     &rxBuf_[ kLorawanRxMetadataOffset ], 
                                     rxLen );
                    *outLen = rxLen;
                    result = true;
                }
            }
        }

        return result;
    }

    bool Lwnode::atTest()
    {
        bool result = false;
        
        if( isInitialized_ )
        {
            char ack[ kAtAckMaxLen ]{};
            if( sendAtCmd( "AT", ack, sizeof( ack ) ) )
            {
                if( ackEquals( ack, "OK\r\n" ) )
                {
                    result = true;
                }
            }
        }

        return result;
    }

    bool Lwnode::writeAtBytes( const uint8_t * const data, uint16_t len )
    {
        bool result = false;

        if( isInitialized_ && ( sensor_ != nullptr ) && ( data != nullptr ) )
        {
            uint16_t left = len;
            uint16_t offset = 0U;
            bool writeFailed = false;

            /* Process data in 30-byte chunks */
            while( ( left > static_cast<uint16_t>( kI2cChunkSize ) ) && !writeFailed )
            {
                if( lwnode_hal_write( sensor_,
                                      kRegWriteAtLong,
                                      &data[ offset ],
                                      kI2cChunkSize ) )
                {
                    offset = ( offset + static_cast<uint16_t>( kI2cChunkSize ) );
                    left   = ( left - static_cast<uint16_t>( kI2cChunkSize ) );
                    lwnode_hal_delay_ms( kI2cChunkDelayMs );
                }
                else
                {
                    writeFailed = true;
                }
            }

            /* Process the remaining bytes (final chunk) */
            if( !writeFailed && ( left > 0U ) )
            {
                if( lwnode_hal_write( sensor_,
                                      kRegWriteAt,
                                      &data[ offset ],
                                      static_cast<size_t>( left ) ) )
                {
                    result = true;
                }
            }
            else if( !writeFailed )
            {
                /* Len was exactly a multiple of 30 and no bytes are left */
                result = true;
            }
            else
            {
                /* Result remains false due to writeFailed */
            }
        }

        return result;
    }

    bool Lwnode::readAckBytes( uint16_t * const outLen )
    {
        bool result = false;

        if( isInitialized_ && ( sensor_ != nullptr ) && ( outLen != nullptr ) )
        {
            uint8_t ucLen = 0U;
            *outLen = 0U;

            /* Read the length of the pending ACK */
            if( lwnode_hal_read( sensor_, kRegReadAtLen, &ucLen, 1U ) )
            {
                const uint16_t usLen = static_cast<uint16_t>( ucLen );

                /* Validate length bounds */
                if( ( usLen > 0U ) && ( usLen <= static_cast<uint16_t>( kAtAckMaxLen ) ) )
                {
                    uint16_t left = usLen;
                    uint16_t offset = 0U;
                    bool readFailed = false;

                    /* Read ACK data in chunks */
                    while( ( left > kI2cChunkSize ) && !readFailed )
                    {
                        if( lwnode_hal_read( sensor_,
                                             kRegReadAt,
                                             &rxBuf_[ offset ],
                                             kI2cChunkSize ) )
                        {
                            offset = ( offset + static_cast<uint16_t>( kI2cChunkSize ) );
                            left   = ( left - static_cast<uint16_t>( kI2cChunkSize ) );
                        }
                        else
                        {
                            readFailed = true;
                        }
                    }

                    /* Read final partial chunk */
                    if( ( !readFailed ) && ( left > 0U ) )
                    {
                        if( lwnode_hal_read( sensor_,
                                             kRegReadAt,
                                             &rxBuf_[ offset ],
                                             static_cast<size_t>( left ) ) )
                        {
                            *outLen = usLen;
                            result = true;
                        }
                    }
                    else if( !readFailed )
                    {
                        /* Len was exactly a multiple of chunk size */
                        *outLen = usLen;
                        result = true;
                    }
                    else
                    {
                        /* Result remains false due to readFailed */
                    }
                }

                if( result )
                {
                    if( usLen < static_cast<uint16_t>( kMaxRxBytes ) )
                    {
                        rxBuf_[ usLen ] = '\0';
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::ackEquals( const char * const ack, 
                            const char * const expected )
    {
        bool result = false;

        if( ( ack != nullptr ) && ( expected != nullptr ) )
        {
            if( strcmp( ack, expected ) == 0 )
            {
                result = true;
            }
        }
        return result;
    }

    bool Lwnode::readLoraData( uint16_t * const outLen )
    {
        bool result = false;

        if ( isInitialized_ && ( sensor_ != nullptr ) && ( outLen != nullptr ) )
        {
            uint8_t ucLen = 0U;
            *outLen = 0U;

            /* Read the length of the data packet in the queue */
            if( lwnode_hal_read( sensor_, kRegReadDataLen, &ucLen, 1U ) )
            {
                const uint16_t usLen = static_cast<uint16_t>( ucLen );

                /* Validate length against hardware limits and buffer capacity */
                if( ( usLen > 0U ) && 
                    ( usLen <= static_cast<uint16_t>( kMaxLoRaPayloadLen ) ) && 
                    ( usLen <= static_cast<uint16_t>( kMaxRxBytes ) ) )
                {
                    uint16_t left = usLen;
                    uint16_t offset = 0U;
                    bool readFailed = false;

                    lwnode_hal_delay_ms( kReadDataDelayMs );

                    /* Read packet data in chunks */
                    while( ( left > kI2cChunkSize ) && !readFailed )
                    {
                        if( lwnode_hal_read( sensor_,
                                             kRegReadData,
                                             &rxBuf_[ offset ],
                                             kI2cChunkSize ) )
                        {
                            offset = ( offset + static_cast<uint16_t>( kI2cChunkSize ) );
                            left   = ( left - static_cast<uint16_t>( kI2cChunkSize ) );
                        }
                        else
                        {
                            readFailed = true;
                        }
                    }

                    /* Read final partial chunk */
                    if( ( !readFailed ) && ( left > 0U ) )
                    {
                        if( lwnode_hal_read( sensor_,
                                             kRegReadData,
                                             &rxBuf_[ offset ],
                                             static_cast<size_t>( left ) ) )
                        {
                            *outLen = usLen;
                            result = true;
                        }
                    }
                    else if( !readFailed )
                    {
                        /* Exact multiple of chunk size */
                        *outLen = usLen;
                        result = true;
                    }
                    else
                    {
                        /* Result remains false due to readFailed */
                    }
                }
            }
        }

        return result;
    }

    bool Lwnode::processRecvFrames( const uint8_t * const buf, 
                                    uint16_t len )
    {
        bool result = false;
        const uint8_t *p = buf;
        uint16_t left = len;
        bool processActive = false;

        if( isInitialized_ && ( buf != nullptr ) && ( len != 0U ) && ( rxCb_ != nullptr ) )
        {
            processActive = true;
            /* Default to true once we start,only set false if protocol error */
            result = true;
        }

        /* Frame Parsing Loop */
        while( ( processActive ) && ( left >= static_cast<uint16_t>( kRecvPrefixLen ) ) )
        {
            /* Sync to the next "+RECV=" prefix */
            if( str_ext_starts_with( p, static_cast<size_t>( left ), kRecvPrefix, kRecvPrefixLen ) )
            {
                p    = &p[ kRecvPrefixLen ];
                left = ( left - static_cast<uint16_t>( kRecvPrefixLen ) );

                /* Validate Metadata Header presence */
                if( left >= kRecvHeaderSize )
                {
                    const int8_t rssi = -( static_cast<int8_t>( p[ kRecvRssiOffset ] ) );
                    const int8_t snr = static_cast<int8_t>( p[ kSnrOffset] - kSnrNormFactor );
                    const uint8_t payLen = p[ kRecvPayloadLenOff ];

                    /* Validate Payload exists in the remaining buffer */
                    if( left >= static_cast<uint16_t>( kRecvHeaderSize + payLen ) )
                    {
                        lastRssi_ = rssi;
                        lastSnr_  = snr;

                        if( payLen > 0U )
                        {
                            rxCb_( &p[ kRecvHeaderSize ], payLen, rssi, snr );
                        }

                        uint16_t step = static_cast<uint16_t>( payLen + kRecvHeaderSize );

                        /* Check for trailing \r\n */
                        if( ( left > ( step + 1U ) ) && 
                            ( p[ step ] == static_cast<uint8_t>( '\r' ) ) )
                        {
                            step = ( step + 2U );
                        }

                        if( left >= step )
                        {
                            p = &p[ step ];
                            left = ( left - step );
                        }
                        else
                        {
                            /* Logic error or buffer underflow */
                            processActive = false;
                            result = false;
                        }
                    }
                    else
                    {
                        /* Incomplete payload */
                        processActive = false; 
                        result = false;
                    }
                }
                else
                {
                    /* Incomplete header */
                    processActive = false; 
                    result = false;
                }
            }
            else
            {
                /* Misalignment: The buffer does not start with +RECV= as expected */
                processActive = false;
                result = false;
            }
        }

        return result;
    }

    bool Lwnode::readAckWithYield( uint16_t * const outLen )
    {
        bool result = false;

        if( isInitialized_ && ( outLen != nullptr ) )
        {
            uint16_t attempts = 0U;
            while( attempts < kAtAckTimeoutLoops )
            {
                if( readAckBytes( outLen ) )
                {
                    result = true;
                    break;
                }
                
                /* Yield to let other tasks run */
                lwnode_hal_delay_ms( kAtAckPollDelayMs );
                attempts++;
            }
        }
        return result;
    }

    bool Lwnode::sendAtCmd( const char * const cmdAscii,
                            char * const ackBuf,
                            size_t ackCap )
    {
        bool result = false;

        if( isInitialized_ && ( sensor_ != nullptr ) && ( cmdAscii != nullptr ) && 
            ( ackBuf != nullptr ) && ( ackCap >= 2U ) ) 
        {
            const size_t cmdLen = str_ext_strnlen( cmdAscii, 
                                                   ( kAtCmdMaxLen - 3U ) );
            
            if( cmdLen > 0U ) 
            {
                uint8_t tx[ kAtCmdMaxLen ]{};

                ( void ) memcpy( tx, cmdAscii, cmdLen );
                tx[ cmdLen ]      = static_cast<uint8_t>( '\r' );
                tx[ cmdLen + 1U ] = static_cast<uint8_t>( '\n' );

                intEnabled_ = false;

                if( writeAtBytes( tx, static_cast<uint16_t>( cmdLen + 2U ) ) ) 
                {
                    lwnode_hal_delay_ms( kAtPostWriteDelayMs );
                    
                    uint16_t actualAckLen = 0;

                    if( readAckWithYield( &actualAckLen ) ) 
                    {
                        /* Buffer Copy */
                        if( actualAckLen >= static_cast<uint16_t>( ackCap ) ) 
                        {
                            actualAckLen = static_cast<uint16_t>( ackCap - 1U );
                        }

                        for( uint16_t i = 0U; i < actualAckLen; ++i ) 
                        {
                            ackBuf[ i ] = static_cast<char>( rxBuf_[ i ] );
                        }
                        ackBuf[ actualAckLen ] = '\0';
                        
                        result = true;
                    }
                }

                intEnabled_ = true;
            }
        }

        return result;
    }

}