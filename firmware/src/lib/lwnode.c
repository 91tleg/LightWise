#include "lwnode.h"

#include <stddef.h>
#include <string.h>

#include "utils/num_fmt.h"
#include "utils/str_ext.h"
#include "hal/lwnode.h"

#define REG_WRITE_AT_LONG                  ( 0x39U )
#define REG_WRITE_AT                       ( 0x40U )
#define REG_READ_AT_LEN                    ( 0x41U )
#define REG_READ_AT                        ( 0x42U )
#define REG_READ_AT_LONG                   ( 0x43U )
#define REG_READ_DATA                      ( 0x45U )
#define REG_READ_NUM_QUEUE			       ( 0x46U )
#define REG_READ_DATA_LEN 			       ( 0x47U )
#define REG_READ_NEXT_DATA 			       ( 0x48U )

#define LWNODE_AT_POST_WRITE_DELAY_MS      ( 800U )
#define LWNODE_AT_ACK_POLL_DELAY_MS        ( 1U )
#define LWNODE_AT_ACK_TIMEOUT_LOOPS        ( 250U )
#define LWNODE_BEGIN_RETRY_COUNT           ( 100U )

#define LWNODE_APP_EUI_PREFIX              "AT+JOINEUI="
#define LWNODE_APP_EUI_PREFIX_LEN          ( sizeof( LWNODE_APP_EUI_PREFIX ) - 1U )
#define LWNODE_APP_EUI_CMD_LEN \
    ( sizeof( LWNODE_APP_EUI_PREFIX ) + LWNODE_MAX_APP_EUI_HEX_CHARS )

#define LWNODE_APP_KEY_PREFIX              "AT+APPKEY="
#define LWNODE_APP_KEY_PREFIX_LEN          ( sizeof( LWNODE_APP_KEY_PREFIX ) - 1U )
#define LWNODE_APP_KEY_CMD_LEN \
    ( sizeof( LWNODE_APP_KEY_PREFIX ) + LWNODE_MAX_APP_KEY_HEX_CHARS )

#define LWNODE_NWK_SKEY_PREFIX             "AT+NWKSKEY="
#define LWNODE_NWK_SKEY_PREFIX_LEN         ( sizeof( LWNODE_NWK_SKEY_PREFIX ) - 1U )
#define LWNODE_NWK_SKEY_CMD_LEN \
    ( sizeof( LWNODE_NWK_SKEY_PREFIX ) + LWNODE_MAX_NWK_SKEY_HEX_CHARS )

#define LWNODE_APP_SKEY_PREFIX             "AT+APPSKEY="
#define LWNODE_APP_SKEY_PREFIX_LEN         ( sizeof( LWNODE_APP_SKEY_PREFIX ) - 1U )
#define LWNODE_APP_SKEY_CMD_LEN \
    ( sizeof( LWNODE_APP_SKEY_PREFIX ) + LWNODE_MAX_APP_SKEY_HEX_CHARS )

#define LWNODE_RECV_PREFIX                 "+RECV="
#define LWNODE_RECV_PREFIX_LEN             ( sizeof( LWNODE_RECV_PREFIX ) - 1U )

#define LWNODE_DEVADDR_PREFIX              "AT+DEVADDR="
#define LWNODE_DEVADDR_PREFIX_LEN          ( sizeof( LWNODE_DEVADDR_PREFIX ) - 1U )
#define LWNODE_DEVADDR_HEX_LEN             ( 8U )
#define LWNODE_DEVADDR_CMD_LEN \
    ( sizeof( LWNODE_DEVADDR_PREFIX ) + LWNODE_DEVADDR_HEX_LEN )

#define LWNODE_DATARATE_PREFIX             "AT+DATARATE=" 
#define LWNODE_DATARATE_PREFIX_LEN         ( sizeof( LWNODE_DATARATE_PREFIX ) - 1U )
#define LWNODE_DATARATE_MAX_DEC_CHARS      ( 3U )  /* 0–255 */
#define LWNODE_DATARATE_CMD_LEN \
    ( sizeof( LWNODE_DATARATE_PREFIX ) + LWNODE_DATARATE_MAX_DEC_CHARS )

#define LWNODE_EIRP_PREFIX                 "AT+EIRP="
#define LWNODE_EIRP_PREFIX_LEN             ( sizeof( LWNODE_EIRP_PREFIX ) - 1U )
#define LWNODE_EIRP_MAX_DEC_CHARS          ( 3U )
#define LWNODE_EIRP_CMD_LEN \
    ( sizeof( LWNODE_EIRP_PREFIX ) + LWNODE_EIRP_MAX_DEC_CHARS )

#define LWNODE_SUBBAND_PREFIX              "AT+SUBBAND="
#define LWNODE_SUBBAND_PREFIX_LEN          ( sizeof( LWNODE_SUBBAND_PREFIX ) - 1U )
#define LWNODE_SUBBAND_MAX_DEC_CHARS       ( 3U )
#define LWNODE_SUBBAND_CMD_LEN \
    ( sizeof( LWNODE_SUBBAND_PREFIX ) + LWNODE_SUBBAND_MAX_DEC_CHARS )

#define LWNODE_ADR_PREFIX                  "AT+ADR="
#define LWNODE_ADR_PREFIX_LEN              ( sizeof( LWNODE_ADR_PREFIX ) - 1U )
#define LWNODE_ADR_VAL_LEN                 ( 1U )
#define LWNODE_ADR_CMD_LEN \
    ( sizeof( LWNODE_ADR_PREFIX ) + LWNODE_ADR_VAL_LEN )

#define LWNODE_SEND_PREFIX                 "AT+SEND="
#define LWNODE_SEND_PREFIX_LEN \
    (sizeof(LWNODE_SEND_PREFIX) - 1U)

#define LWNODE_LORAWAN_RX_METADATA_OFFSET  ( 9U )
#define LWNODE_RSSI_INDEX                  ( 6U )
#define LWNODE_SNR_INDEX                   ( 7U )
#define LWNODE_SNR_OFFSET                  ( 50 )

#define LWNODE_RECV_RSSI_OFFSET            ( 0U )
#define LWNODE_RECV_SNR_OFFSET             ( 1U )
#define LWNODE_RECV_PAYLEN_OFFSET          ( 2U )
#define LWNODE_RECV_HEADER_SIZE            ( 3U )
#define LWNODE_SNR_NORM_FACTOR             ( 50U )

#define LWNODE_I2C_CHUNK_SIZE              ( 30U )
#define LWNODE_I2C_CHUNK_DELAY_MS          ( 100U )
#define LWNODE_MAX_LORA_PAYLOAD_LEN        ( 128U )
#define LWNODE_READ_DATA_DELAY_MS          ( 100U )

#define LWNODE_AT_ACK_MAX_LEN              ( 64U )
#define LWNODE_AT_CMD_MAX_LEN              ( 520U )

static bool lwnode_at_test( LwnodeDevice * const device );
static bool lwnode_write_at_bytes( const LwnodeDevice * const device,
                                   const uint8_t * const data,
                                   uint16_t len );
static bool lwnode_read_ack_bytes( LwnodeDevice * const device,
                                   uint16_t * const outLen );
static bool lwnode_send_at_cmd( LwnodeDevice * const device,
                                const char * const cmdAscii,
                                char * const ackBuf, size_t ackCap );
static bool lwnode_ack_equals( const char * const ack,
                               const char * const expected );
static bool lwnode_read_lora_data( LwnodeDevice * const device,
                                   uint16_t * const outLen );
static bool lwnode_process_recv_frames( LwnodeDevice * const device,
                                        const uint8_t * const buf,
                                        uint16_t len );
static bool lwnode_read_ack_with_yield( LwnodeDevice * const device,
                                        uint16_t * const outLen );

bool lwnode_init( LwnodeDevice * const device, 
                  const LwnodeHw * const sensor )
{
    bool result = false;

    if( ( device != NULL) && ( sensor != NULL ) )
    {
        ( void ) memset( device, 0, sizeof( *device ) );
        device->sensor = sensor;
        device->intEnabled = true;
        device->region = LWNODE_REGION_US915;
        device->joinType = LWNODE_JOIN_OTAA;

        device->isInitialized = true;
        result = true;
    }

    return result;
}

bool lwnode_set_rx_cb( LwnodeDevice * const device, 
                       LwnodeRxCb callback )
{
    bool result = false;

    if( ( device != NULL ) && ( callback != NULL ) )
    {
        device->rxCb = callback;
        result = true;
    }

    return result;
}

int8_t lwnode_last_rssi( const LwnodeDevice * const device )
{
    int8_t lastRssi = 0;

    if( device != NULL )
    {
        lastRssi = device->lastRssi;
    }

    return lastRssi;
}

int8_t lwnode_last_snr( const LwnodeDevice * const device )
{
    int8_t lastSnr = 0;

    if( device != NULL )
    {
        lastSnr = device->lastSnr;
    }

    return lastSnr;
}

bool lwnode_config_otaa( LwnodeDevice * const device )
{
    bool result = false;

    if( device != NULL )
    {
        device->joinType = LWNODE_JOIN_OTAA;
        result = true;
    }

    return result;
}

bool lwnode_config_abp( LwnodeDevice * const device )
{
    bool result = false;

    if( device != NULL )
    {
        device->joinType = LWNODE_JOIN_ABP;
        result = true;
    }

    return result;
}

bool lwnode_set_region( LwnodeDevice * const device, 
                        LwnodeRegion region )
{
    bool result = false;

    if( device != NULL )
    {
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        const char * cmd = NULL;

        switch( region )
        {
            case LWNODE_REGION_EU868: 
                cmd = "AT+REGION=EU868"; 
                break;
            case LWNODE_REGION_US915:
                cmd = "AT+REGION=US915"; 
                break;
            case LWNODE_REGION_CN470:
                cmd = "AT+REGION=CN470"; 
                break;
            default:
                /* Invalid region */
                break;
        }

        if( cmd != NULL )
        {
            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+REGION=OK\r\n" ) )
                {
                    device->region = region;
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_set_app_eui( LwnodeDevice * const device, 
                         const char * const joinEuiHex16 )
{
    bool result = false;

    if( ( device != NULL ) && ( joinEuiHex16 != NULL ) )
    {
        const size_t n = str_ext_strnlen( joinEuiHex16, 
                                          LWNODE_MAX_APP_EUI_HEX_CHARS + 1U );
        if( n == LWNODE_MAX_APP_EUI_HEX_CHARS )
        {    
            char cmd[ LWNODE_APP_EUI_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            ( void ) memcpy( device->appEui, 
                             joinEuiHex16, 
                             LWNODE_MAX_APP_EUI_HEX_CHARS );
            device->appEui[ LWNODE_MAX_APP_EUI_HEX_CHARS ] = '\0';

            str_ext_to_upper_case(device->appEui);

            ( void ) memcpy( cmd, 
                            LWNODE_APP_EUI_PREFIX, 
                            LWNODE_APP_EUI_PREFIX_LEN );
            ( void ) memcpy( &cmd[ LWNODE_APP_EUI_PREFIX_LEN ], 
                            device->appEui, 
                            LWNODE_MAX_APP_EUI_HEX_CHARS );
            cmd[ LWNODE_APP_EUI_CMD_LEN - 1U ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+JOINEUI=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_set_app_key( LwnodeDevice * const device, 
                         const char * const appKeyHex32 )
{
    bool result = false;

    if( ( device != NULL ) && ( appKeyHex32 != NULL ) )
    {
        const size_t n = str_ext_strnlen( appKeyHex32, 
                                          LWNODE_MAX_APP_KEY_HEX_CHARS + 1U );
        if( n == LWNODE_MAX_APP_KEY_HEX_CHARS )
        {    
            char cmd[ LWNODE_APP_KEY_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            ( void ) memcpy( device->appKey, appKeyHex32, LWNODE_MAX_APP_KEY_HEX_CHARS );
            device->appKey[ LWNODE_MAX_APP_KEY_HEX_CHARS ] = '\0';
            str_ext_to_upper_case( device->appKey );

            ( void ) memcpy( cmd, LWNODE_APP_KEY_PREFIX, LWNODE_APP_KEY_PREFIX_LEN );
            ( void ) memcpy( &cmd[ LWNODE_APP_KEY_PREFIX_LEN ], 
                             device->appKey, 
                             LWNODE_MAX_APP_KEY_HEX_CHARS );
            cmd[ LWNODE_APP_KEY_CMD_LEN - 1U ] = '\0' ;

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+APPKEY=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }
        
    return result;
}

bool lwnode_set_nwk_skey( LwnodeDevice * const device, 
                          const char * const nwkSkeyHex32 )
{
    bool result = false;

    if( ( device != NULL ) && ( nwkSkeyHex32 != NULL ) )
    {
        const size_t n = str_ext_strnlen( nwkSkeyHex32, 
                                          LWNODE_MAX_NWK_SKEY_HEX_CHARS + 1U );
        if( n == LWNODE_MAX_NWK_SKEY_HEX_CHARS )
        {
            char cmd[ LWNODE_NWK_SKEY_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            ( void ) memcpy( device->nwkSkey, 
                             nwkSkeyHex32, 
                             LWNODE_MAX_NWK_SKEY_HEX_CHARS );
            device->nwkSkey[ LWNODE_MAX_NWK_SKEY_HEX_CHARS ] = '\0';
            str_ext_to_upper_case( device->nwkSkey );

            ( void ) memcpy( cmd, 
                             LWNODE_NWK_SKEY_PREFIX, 
                             LWNODE_NWK_SKEY_PREFIX_LEN );
            ( void ) memcpy( &cmd[ LWNODE_NWK_SKEY_PREFIX_LEN ], 
                             device->nwkSkey, 
                             LWNODE_MAX_NWK_SKEY_HEX_CHARS );
            cmd[ LWNODE_NWK_SKEY_CMD_LEN - 1U ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+NWKSKEY=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_set_app_skey( LwnodeDevice * const device, 
                          const char * const appSkeyHex32 )
{
    bool result = false;

    if ((device != NULL) && (appSkeyHex32 != NULL))
    {
        char cmd[ LWNODE_APP_SKEY_CMD_LEN ] = {};
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

        const size_t n = str_ext_strnlen( appSkeyHex32, 
                                          LWNODE_MAX_APP_SKEY_HEX_CHARS + 1U );
        if( n == LWNODE_MAX_APP_SKEY_HEX_CHARS )
        {
            ( void ) memcpy( device->appSkey, 
                             appSkeyHex32, 
                             LWNODE_MAX_APP_SKEY_HEX_CHARS );
            device->appSkey[ LWNODE_MAX_APP_SKEY_HEX_CHARS ] = '\0';
            str_ext_to_upper_case( device->appSkey );

            ( void ) memcpy( cmd, 
                             LWNODE_APP_SKEY_PREFIX, 
                             LWNODE_APP_SKEY_PREFIX_LEN );
            ( void ) memcpy( &cmd[ LWNODE_APP_SKEY_PREFIX_LEN ], 
                             device->appSkey, 
                             LWNODE_MAX_APP_SKEY_HEX_CHARS );
            cmd[ LWNODE_APP_SKEY_CMD_LEN - 1U ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+APPSKEY=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }
    
    return result;
}

bool lwnode_set_dev_addr( LwnodeDevice * const device, 
                          uint32_t devAddr )
{
    bool result = false;

    if( device != NULL )
    {   
        char hexAddr[ 9 ] = {};

        if( num_fmt_u32_to_hex8( devAddr, hexAddr, sizeof( hexAddr ) ) )
        {
            char cmd[ LWNODE_DEVADDR_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            ( void ) memcpy( cmd, 
                             LWNODE_DEVADDR_PREFIX, 
                             LWNODE_DEVADDR_PREFIX_LEN );
            ( void ) memcpy( &cmd[ LWNODE_DEVADDR_PREFIX_LEN ], 
                             hexAddr, 
                             LWNODE_DEVADDR_HEX_LEN );
            cmd[ LWNODE_DEVADDR_CMD_LEN - 1U ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+DEVADDR=OK\r\n" ) )
                {
                    device->devAddr = devAddr;
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_set_class( LwnodeDevice * const device, 
                       LwnodeClass classType )
{
    bool result = false;

    if( device != NULL )
    {
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        const char * cmd = NULL;

        switch( classType )
        {
            case LWNODE_CLASS_A:
                cmd = "AT+CLASS=CLASS_A";
                break;
            case LWNODE_CLASS_C:
                cmd = "AT+CLASS=CLASS_C";
                break;
            default: 
                /* Invalid class */
                break;

        }

        if( cmd != NULL )
        {
            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+CLASS=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

//maybe ok
bool lwnode_set_datarate( LwnodeDevice * const device, 
                          uint8_t dataRate )
{
    bool result = false;

    if( device != NULL )
    {

        char dataRateStr[ LWNODE_DATARATE_MAX_DEC_CHARS + 1U ];

        if( num_fmt_u8toa( dataRate, dataRateStr, sizeof( dataRateStr ) ) )
        {
            char cmd[ LWNODE_DATARATE_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            const size_t len = str_ext_strnlen( dataRateStr, sizeof( dataRateStr ) );

            ( void ) memcpy( cmd,
                             LWNODE_DATARATE_PREFIX,
                             LWNODE_DATARATE_PREFIX_LEN );

            ( void ) memcpy( &cmd[ LWNODE_DATARATE_PREFIX_LEN ],
                             dataRateStr,
                             len );

            cmd[ LWNODE_DATARATE_PREFIX_LEN + len ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+DATARATE=OK\r\n" ) )
                {
                    device->dataRate = dataRate;
                    result = true;
                }
            }
        }
    }

    return result;
}

//maybe ok
bool lwnode_set_eirp( LwnodeDevice * const device, 
                      uint8_t eirp )
{
    bool result = false;

    if( device != NULL )
    {
        char numStr[ LWNODE_EIRP_MAX_DEC_CHARS + 1U ];

        if( num_fmt_u8toa( eirp, numStr, sizeof( numStr ) ) )
        {
            char cmd[ LWNODE_EIRP_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            const size_t len = str_ext_strnlen( numStr, sizeof( numStr ) );

            ( void ) memcpy( cmd, 
                             LWNODE_EIRP_PREFIX, 
                             LWNODE_EIRP_PREFIX_LEN );

            ( void ) memcpy( &cmd[ LWNODE_EIRP_PREFIX_LEN ], 
                             numStr, 
                             len );

            cmd[ LWNODE_EIRP_PREFIX_LEN + len ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+EIRP=OK\r\n" ) )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

//maybe ok
bool lwnode_set_subband( LwnodeDevice * const device, 
                         uint8_t subBand )
{
    bool result = false;

    if( ( device != NULL ) && ( device->region != LWNODE_REGION_EU868 ) )
    {
        char numStr[ LWNODE_SUBBAND_MAX_DEC_CHARS + 1U ];

        if( num_fmt_u8toa( subBand, numStr, sizeof( numStr ) ) )
        {
            char cmd[ LWNODE_SUBBAND_CMD_LEN ] = {};
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            const size_t len = str_ext_strnlen( numStr, sizeof( numStr ) );

            ( void ) memcpy( cmd, 
                             LWNODE_SUBBAND_PREFIX, 
                             LWNODE_SUBBAND_PREFIX_LEN );

            ( void ) memcpy( &cmd[ LWNODE_SUBBAND_PREFIX_LEN ], 
                             numStr, 
                             len );

            cmd[ LWNODE_SUBBAND_PREFIX_LEN + len ] = '\0';

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+SUBBAND=OK\r\n" ) )
                {
                    device->subBand = subBand;
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_enable_adr( LwnodeDevice * const device, 
                        bool adr )
{
    bool result = false;

    if( device != NULL )
    {
        char cmd[ LWNODE_ADR_CMD_LEN ] = {};
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

        /* 1. Build Command: "AT+ADR=" + '0' or '1' */
        ( void ) memcpy( cmd, 
                         LWNODE_ADR_PREFIX, 
                         LWNODE_ADR_PREFIX_LEN );

        cmd[ LWNODE_ADR_PREFIX_LEN ] = adr ? ( uint8_t ) '1' : ( uint8_t ) '0';
        cmd[ LWNODE_ADR_PREFIX_LEN + 1U ] = '\0';

        if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
        {
            if( lwnode_ack_equals( ack, "+ADR=OK\r\n" ) )
            {
                device->adr = adr;
                result = true;
            }
        }
    }

    return result;
}

bool lwnode_set_packet_type( LwnodeDevice * const device, 
                             LwnodePacketType type)
{
    bool result = false;
   
    if( device != NULL )
    {
        const char * cmd = NULL;

        switch( type )
        {
            case LWNODE_PACKET_UNCONFIRMED:
                cmd = "AT+UPLINKTYPE=UNCONFIRMED";
                break;
            case LWNODE_PACKET_CONFIRMED:
                cmd = "AT+UPLINKTYPE=CONFIRMED"; 
                break;
            default:
                /* Invalid type */
                break;
        }
        
        if( cmd != NULL )
        {
            char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};

            if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
            {
                if( lwnode_ack_equals( ack, "+UPLINKTYPE=OK\r\n") )
                {
                    result = true;
                }
            }
        }
    }

    return result;
}

bool lwnode_begin( LwnodeDevice * const device )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) )
    {    
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        uint8_t retry = LWNODE_BEGIN_RETRY_COUNT;

        ( void ) lwnode_send_at_cmd( device, "AT+REBOOT", ack, sizeof( ack ) );
        lwnode_hal_delay_ms( 100U );

        /* AT Test */
        while( retry > 0U )
        {
            if( lwnode_at_test( device ) )
            {
                result = true;
                break;
            }
            retry--;
            lwnode_hal_delay_ms( 10U ); /* Small yield during init */
        }

        /* Global Configuration (Only if AT test passed) */
        if( result )
        {
            /* Enable receive queue */
            ( void ) lwnode_send_at_cmd( device, "AT+RECV=1", ack, sizeof( ack ) );
            
            /* Set mode to LoRaWAN: OTAA and ABP */
            result = lwnode_send_at_cmd( device, "AT+LORAMODE=LORAWAN", ack, sizeof( ack ) );
        }

        /* Join Type Specific Configuration */
        if( result )
        {
            if( device->joinType == LWNODE_JOIN_ABP )
            {
                result = lwnode_send_at_cmd( device, "AT+JOINTYPE=ABP", ack, sizeof( ack ) );
                result = result && lwnode_ack_equals( ack, "+JOINTYPE=OK\r\n" );

                if( result && ( device->nwkSkey[ 0 ] != '\0' ) )
                {
                    result = lwnode_set_nwk_skey( device, device->nwkSkey );
                }
                if( result && (device->appSkey[ 0 ] != '\0' ) )
                {
                    result = lwnode_set_app_skey( device, device->appSkey );
                }
                if( result && ( device->devAddr != 0U ) )
                {
                    result = lwnode_set_dev_addr( device, device->devAddr );
                }
            }
            else /* LWNODE_JOIN_OTAA */
            {
                result = lwnode_send_at_cmd( device, "AT+JOINTYPE=OTAA", ack, sizeof( ack ) );
                result = result && lwnode_ack_equals( ack, "+JOINTYPE=OK\r\n" );

                if( result && ( device->appEui[ 0 ] != '\0' ) )
                {
                    result = lwnode_set_app_eui( device, device->appEui );
                }
                if( result && ( device->appKey[ 0 ] != '\0' ) )
                {
                    result = lwnode_set_app_key( device, device->appKey );
                }
            }
        }
    }

    return result;
}

bool lwnode_join( LwnodeDevice * const device )
{
    bool result = false;

    if( device != NULL )
    {
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        if( lwnode_send_at_cmd( device, "AT+JOIN=1", ack, sizeof( ack ) ))
        {
            if( lwnode_ack_equals( ack, "+JOIN=OK\r\n") )
            {
                result = true;
            }
        }
    }

    return result;
}

bool lwnode_is_joined( LwnodeDevice * const device)
{
    bool result = false;
    
    if( device != NULL )
    {
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        if( lwnode_send_at_cmd( device, "AT+JOIN?", ack, sizeof( ack ) ) )
        {
            if( lwnode_ack_equals(ack, "+JOIN=1\r\n") )
            {
                result = true;
            }
        }
    }

    return result;
}

bool lwnode_send_packet_bytes( LwnodeDevice * const device, 
                               const uint8_t * const data, 
                               uint8_t len )
{
    bool result = false;

    if( ( device != NULL ) && ( data != NULL ) && 
        ( len != 0U ) && ( len <= LWNODE_MAX_RX_BYTES ) )
    {    
        char cmd[ LWNODE_AT_CMD_MAX_LEN ] = {}; 
        char hex[ ( LWNODE_MAX_RX_BYTES * 2U ) + 1U ];
        char ack[ LWNODE_AT_ACK_MAX_LEN ];

        /* Hex encode the raw bytes into ASCII hex */
        if( num_fmt_hex_encode( data, len, hex, sizeof( hex ) ) )
        {
            size_t hexLen = str_ext_strnlen( hex, sizeof( hex ) );
        
            ( void ) memcpy( cmd, LWNODE_SEND_PREFIX, LWNODE_SEND_PREFIX_LEN );

            if( ( 8U + hexLen ) < sizeof( cmd ) )
            {
                ( void ) strncat( cmd, hex, sizeof( cmd ) - 9U );

                if( lwnode_send_at_cmd( device, cmd, ack, sizeof( ack ) ) )
                {
                    if( lwnode_ack_equals( ack, "+SEND=OK\r\n" ) || 
                        lwnode_ack_equals( ack, "AT+SEND=OK\r\n" ) )
                    {
                        result = true;
                    }
                }
            }
        }
    }

    return result;
}


bool lwnode_sleep_ms( LwnodeDevice * const device, uint32_t ms)
{
    if( device != NULL )
    {
        uint32_t t = 0U;
        uint16_t rx_len;

        while (t < ms)
        {
            /* If no callbacks registered, just delay in bounded steps */
            if( device->rxCb == NULL )
            {
                uint32_t remaining = ms - t;
                uint32_t step = ( remaining > 100U ) ? 100U : remaining;
                lwnode_hal_delay_ms( step );
                t += step;
                continue;
            }

            /* Poll for queued data */
            if( lwnode_read_lora_data( device, &rx_len ) )
            {
                ( void ) lwnode_process_recv_frames( device, device->rxBuf, rx_len );
            }

            lwnode_hal_delay_ms( 1U );
            t += 1U;
        }
    }

    return true;
}

bool lwnode_read_data_bytes( LwnodeDevice * const device, 
                             uint8_t * const out, 
                             uint16_t outMax, 
                             uint16_t * const outLen )
{
    bool result = false;
    
    if( ( device != NULL ) && ( out != NULL ) && ( outLen != NULL ) && ( outMax != 0U ) )
    {
        uint16_t rxLen = 0U;
        *outLen = 0U;

        if( lwnode_read_lora_data( device, &rxLen ) )
        {
            /* LoRaWAN frame validation (must exceed metadata header) */
            if( rxLen > LWNODE_LORAWAN_RX_METADATA_OFFSET )
            {
                /* Extract Metadata (RSSI/SNR) */
                device->lastRssi = ( int8_t ) ( -( int8_t ) device->rxBuf[ LWNODE_RSSI_INDEX ] );
                device->lastSnr  = 
                    ( int8_t ) ( ( int8_t ) device->rxBuf[ LWNODE_SNR_INDEX ] - LWNODE_SNR_OFFSET );

                /* Calculate payload size and apply bounds checking */
                rxLen = ( uint16_t ) ( rxLen - LWNODE_LORAWAN_RX_METADATA_OFFSET );
                
                if( rxLen > outMax )
                {
                    rxLen = outMax;
                }

                /* Copy payload and update output length */
                ( void ) memcpy( out, 
                                 &device->rxBuf[ LWNODE_LORAWAN_RX_METADATA_OFFSET ], 
                                 rxLen );
                *outLen = rxLen;
                result = true;
            }
        }
    }

    return result;
}

/**
 * @brief Send a basic "AT" command to verify node responsiveness.
 *
 * Sends the ASCII "AT" command and checks for a standard "OK\r\n" response.
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 *
 * @retval true  Node responded with a valid OK acknowledgment.
 * @retval false Device is NULL, communication failed, or unexpected response.
 */
static bool lwnode_at_test( LwnodeDevice * const device )
{
    bool result = false;
    
    if( device != NULL )
    {
        char ack[ LWNODE_AT_ACK_MAX_LEN ] = {};
        if( lwnode_send_at_cmd( device, "AT", ack, sizeof( ack ) ) )
        {
            if( lwnode_ack_equals( ack, "OK\r\n" ) )
            {
                result = true;
            }
        }
    }

    return result;
}

/**
 * @brief Write an AT command payload to the node over I2C.
 *
 * The payload is written in fixed-size chunks due to I2C transfer limits.
 * All chunks except the final one are written using the long-write register.
 *
 * @param[in] device Pointer to the LoRa node device instance.
 * @param[in] data   Pointer to the AT command byte buffer.
 * @param[in] len    Total number of bytes to write.
 *
 * @retval true  All bytes were written successfully.
 * @retval false Invalid arguments or an I2C write failure occurred.
 */
static bool lwnode_write_at_bytes( const LwnodeDevice * const device, 
                                   const uint8_t * const data, 
                                   uint16_t len )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) && ( data != NULL ) )
    {
        uint16_t left = len;
        uint16_t offset = 0U;
        bool writeFailed = false;

        /* Process data in 30-byte chunks */
        while( ( left > LWNODE_I2C_CHUNK_SIZE ) && ( !writeFailed ) )
        {
            if( lwnode_hal_write( device->sensor, 
                                  REG_WRITE_AT_LONG,
                                  &data[ offset ], 
                                  LWNODE_I2C_CHUNK_SIZE ) )
            {
                offset = ( uint16_t ) ( offset + LWNODE_I2C_CHUNK_SIZE );
                left   = ( uint16_t ) ( left - LWNODE_I2C_CHUNK_SIZE );
                lwnode_hal_delay_ms( LWNODE_I2C_CHUNK_DELAY_MS );
            }
            else
            {
                writeFailed = true;
            }
        }

        /* Process the remaining bytes (final chunk) */
        if( ( !writeFailed ) && ( left > 0U ) )
        {
            if( lwnode_hal_write( device->sensor, 
                                  REG_WRITE_AT, 
                                  &data[ offset ], 
                                  ( size_t ) left ) )
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

/**
 * @brief Read an AT command acknowledgment from the node.
 *
 * Reads the pending ACK length first, then retrieves the ACK data into
 * the device RX buffer in bounded chunks.
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 * @param[out]    outLen Number of bytes read into the RX buffer.
 *
 * @retval true  A valid acknowledgment was read successfully.
 * @retval false Invalid arguments, no ACK available, or read failure.
 */
static bool lwnode_read_ack_bytes( LwnodeDevice * const device, 
                                   uint16_t * const outLen )
{
    bool result = false;
    

    if( ( device != NULL ) && ( device->sensor != NULL ) && ( outLen != NULL ) )
    {
        uint8_t ucLen = 0U;
        *outLen = 0U;

        /* Read the length of the pending ACK */
        if( lwnode_hal_read( device->sensor, REG_READ_AT_LEN, &ucLen, 1U ) )
        {
            const uint16_t usLen = ( uint16_t ) ucLen;

            /* Validate length bounds */
            if( ( usLen > 0U ) && ( usLen <= LWNODE_AT_ACK_MAX_LEN ) )
            {
                uint16_t left = usLen;
                uint16_t offset = 0U;
                bool readFailed = false;

                /* Read ACK data in chunks */
                while( ( left > LWNODE_I2C_CHUNK_SIZE ) && ( !readFailed ) )
                {
                    if( lwnode_hal_read( device->sensor, 
                                         REG_READ_AT, 
                                         &device->rxBuf[ offset ], 
                                         LWNODE_I2C_CHUNK_SIZE ) )
                    {
                        offset = ( uint16_t ) ( offset + LWNODE_I2C_CHUNK_SIZE );
                        left   = ( uint16_t ) ( left - LWNODE_I2C_CHUNK_SIZE );
                    }
                    else
                    {
                        readFailed = true;
                    }
                }

                /* Read final partial chunk */
                if( ( !readFailed ) && ( left > 0U ) )
                {
                    if( lwnode_hal_read( device->sensor, 
                                         REG_READ_AT, 
                                         &device->rxBuf[ offset ], 
                                         ( size_t ) left ) )
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
                if( usLen < LWNODE_MAX_RX_BYTES )
                {
                    device->rxBuf[ usLen ] = '\0';
                }
            }
        }
    }

    return result;
}

/**
 * @brief Compare an AT acknowledgment string against an expected value.
 *
 * Performs a full string comparison, including line terminators.
 *
 * @param[in] ack      Pointer to the received ACK string.
 * @param[in] expected Pointer to the expected ACK string.
 *
 * @retval true  Strings match exactly.
 * @retval false One or both pointers are NULL or strings differ.
 */
static bool lwnode_ack_equals( const char * const ack, 
                               const char * const expected )
{
    bool result = false;

    if( ( ack != NULL ) && ( expected != NULL ) )
    {
        if( strcmp( ack, expected ) == 0 )
        {
            result = true;
        }
    }
    return result;
}

/**
 * @brief Read a queued LoRa payload from the node.
 *
 * Reads the length of the pending data packet, validates it against
 * hardware and buffer limits, and then reads the payload into the RX buffer.
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 * @param[out]    outLen Number of bytes read into the RX buffer.
 *
 * @retval true  A complete LoRa packet was read successfully.
 * @retval false Invalid arguments, no data available, or read failure.
 */
static bool lwnode_read_lora_data( LwnodeDevice * const device, 
                                   uint16_t * const outLen )
{
    bool result = false;
    uint8_t ucLen = 0U;

    if ( ( device != NULL ) && ( device->sensor != NULL ) && ( outLen != NULL ) )
    {
        *outLen = 0U;

        /* Read the length of the data packet in the queue */
        if( lwnode_hal_read( device->sensor, REG_READ_DATA_LEN, &ucLen, 1U ) )
        {
            const uint16_t usLen = ( uint16_t ) ucLen;

            /* Validate length against hardware limits and buffer capacity */
            if( ( usLen > 0U ) && 
                ( usLen <= LWNODE_MAX_LORA_PAYLOAD_LEN ) && 
                ( usLen <= LWNODE_MAX_RX_BYTES ) )
            {
                uint16_t left = usLen;
                uint16_t offset = 0U;
                bool readFailed = false;

                lwnode_hal_delay_ms( LWNODE_READ_DATA_DELAY_MS );

                /* Read packet data in chunks */
                while( ( left > LWNODE_I2C_CHUNK_SIZE ) && ( !readFailed ) )
                {
                    if( lwnode_hal_read( device->sensor, 
                                         REG_READ_DATA, 
                                         &device->rxBuf[ offset ], 
                                         LWNODE_I2C_CHUNK_SIZE ) )
                    {
                        offset = ( uint16_t ) ( offset + LWNODE_I2C_CHUNK_SIZE );
                        left   = ( uint16_t ) ( left - LWNODE_I2C_CHUNK_SIZE );
                    }
                    else
                    {
                        readFailed = true;
                    }
                }

                /* Read final partial chunk */
                if( ( !readFailed ) && ( left > 0U ) )
                {
                    if( lwnode_hal_read( device->sensor,
                                         REG_READ_DATA, 
                                         &device->rxBuf[ offset ], 
                                         ( size_t ) left ) )
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

/**
 * @brief Parse "+RECV=" frames and dispatch received payloads.
 *
 * Parses one or more "+RECV=" frames from a raw buffer, extracts RSSI,
 * SNR, and payload data, and invokes the registered RX callback.
 *
 * Expected frame format:
 *   "+RECV=" [RSSI][SNR][LEN][PAYLOAD][\\r\\n]
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 * @param[in]     buf    Pointer to the received data buffer.
 * @param[in]     len    Length of the received buffer in bytes.
 *
 * @retval true  All frames were parsed and processed successfully.
 * @retval false Protocol error, malformed frame, or invalid arguments.
 */
static bool lwnode_process_recv_frames( LwnodeDevice * const device, 
                                        const uint8_t * const buf, 
                                        uint16_t len )
{
    bool result = false;
    const uint8_t *p = buf;
    uint16_t left = len;
    bool processActive = false;

    if( ( device != NULL ) && ( buf != NULL ) && ( len != 0U ) && ( device->rxCb != NULL ) )
    {
        processActive = true;
        /* Default to true once we start,only set false if protocol error */
        result = true;
    }

    /* Frame Parsing Loop */
    while( ( processActive ) && ( left >= LWNODE_RECV_PREFIX_LEN ) )
    {
        /* Sync to the next "+RECV=" prefix */
        if( str_ext_starts_with( p, ( size_t ) left, LWNODE_RECV_PREFIX, LWNODE_RECV_PREFIX_LEN ) )
        {
            p    = &p[ LWNODE_RECV_PREFIX_LEN ];
            left = ( uint16_t )( left - LWNODE_RECV_PREFIX_LEN );

            /* Validate Metadata Header presence */
            if( left >= LWNODE_RECV_HEADER_SIZE )
            {
                const int8_t rssi = ( int8_t ) ( -( int8_t ) p[ LWNODE_RECV_RSSI_OFFSET ] );
                const int8_t snr = 
                    ( int8_t ) ( ( int8_t ) p[ LWNODE_RECV_SNR_OFFSET ] - LWNODE_SNR_NORM_FACTOR );
                const uint8_t payLen = p[ LWNODE_RECV_PAYLEN_OFFSET ];

                /* Validate Payload exists in the remaining buffer */
                if( left >= ( uint16_t ) ( LWNODE_RECV_HEADER_SIZE + ( uint16_t ) payLen ) )
                {
                    device->lastRssi = rssi;
                    device->lastSnr  = snr;

                    if( payLen > 0U )
                    {
                        device->rxCb( &p[ LWNODE_RECV_HEADER_SIZE ], payLen, rssi, snr );
                    }

                    uint16_t step = ( uint16_t ) ( ( uint16_t ) payLen + LWNODE_RECV_HEADER_SIZE );

                    /* Check for trailing \r\n */
                    if( ( left > ( uint16_t ) ( step + 1U ) ) && 
                        ( p[ step ] == ( uint8_t ) '\r' ) )
                    {
                        step = ( uint16_t ) ( step + 2U );
                    }

                    if( left >= step )
                    {
                        p = &p[ step ];
                        left = ( uint16_t ) ( left - step );
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

/**
 * @brief Poll for an AT acknowledgment with cooperative task yielding.
 *
 * Repeatedly attempts to read an ACK, yielding between attempts to allow
 * other tasks to execute.
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 * @param[out]    outLen Number of bytes read into the RX buffer.
 *
 * @retval true  An acknowledgment was received within the timeout window.
 * @retval false Timeout expired or read failure occurred.
 */
static bool lwnode_read_ack_with_yield( LwnodeDevice * const device,
                                        uint16_t * const outLen )
{
    bool result = false;
    uint16_t attempts = 0U;

    while( attempts < LWNODE_AT_ACK_TIMEOUT_LOOPS )
    {
        if( lwnode_read_ack_bytes( device, outLen ) )
        {
            result = true;
            break;
        }
        
        // Yield for 1ms to let other tasks run
        lwnode_hal_delay_ms( LWNODE_AT_ACK_POLL_DELAY_MS );
        attempts++;
    }
    return result;
}

/**
 * @brief Send an ASCII AT command and retrieve its acknowledgment.
 *
 * Appends CRLF to the command, writes it to the node, then polls for
 * the acknowledgment. The ACK is copied into a caller-provided buffer
 * and null-terminated.
 *
 * Interrupt-driven processing is temporarily disabled during the
 * transaction.
 *
 * @param[in,out] device Pointer to the LoRa node device instance.
 * @param[in]     cmdAscii Null-terminated ASCII AT command (without CRLF).
 * @param[out]    ackBuf   Buffer to receive the acknowledgment string.
 * @param[in]     ackCap   Capacity of the acknowledgment buffer.
 *
 * @retval true  Command sent and acknowledgment received successfully.
 * @retval false Invalid arguments, write failure, or timeout.
 */
static bool lwnode_send_at_cmd( LwnodeDevice * const device,
                                const char * const cmdAscii,
                                char * const ackBuf,
                                size_t ackCap )
{
    bool result = false;

    if( ( device != NULL ) && ( device->sensor != NULL ) && ( cmdAscii != NULL ) && 
        ( ackBuf != NULL ) && ( ackCap >= 2U ) ) 
    {
        const size_t cmdLen = str_ext_strnlen( cmdAscii, 
                                               ( size_t ) ( LWNODE_AT_CMD_MAX_LEN - 3U ) );
        
        if( cmdLen > 0U ) 
        {
            uint8_t tx[ LWNODE_AT_CMD_MAX_LEN ] = {};

            ( void ) memcpy( tx, cmdAscii, cmdLen );
            tx[ cmdLen ]      = ( uint8_t ) '\r';
            tx[ cmdLen + 1U ] = ( uint8_t ) '\n';

            device->intEnabled = false;

            if( lwnode_write_at_bytes( device, tx, ( uint16_t ) ( cmdLen + 2U ) ) ) 
            {
                lwnode_hal_delay_ms( LWNODE_AT_POST_WRITE_DELAY_MS );
                
                uint16_t actualAckLen = 0;
                /* Poll for Response */
                if( lwnode_read_ack_with_yield( device, &actualAckLen ) ) 
                {
                    /* Buffer Copy */
                    if( actualAckLen >= ( uint16_t ) ackCap ) 
                    {
                        actualAckLen = ( uint16_t ) ( ackCap - 1U );
                    }

                    for( uint16_t i = 0U; i < actualAckLen; ++i ) 
                    {
                        ackBuf[ i ] = ( char ) device->rxBuf[ i ];
                    }
                    ackBuf[ actualAckLen ] = '\0';
                    
                    result = true;
                }
            }

            device->intEnabled = true;
        }
    }

    return result;
}
