/******************************************************************************
 * @file lwnode.h
 * @brief DFRobot LoRaWAN Node (LWNode) Driver
 * 
 * This module provides a complete interface for configuring and operating a
 * LoRaWAN module via AT commands. It supports both OTAA (Over-The-Air Activation)
 * and ABP (Activation By Personalization) join modes, region configuration,
 * radio parameter tuning, and full duplex communication with receive callbacks.
 ******************************************************************************/
 
#ifndef SRC_LIB_LWNODE_H
#define SRC_LIB_LWNODE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/** @defgroup LwnodeConfig LWNode Configuration Constants */
/** @{ */
#define LWNODE_MAX_RX_BYTES              ( 256U )  /**< Maximum receive buffer size in bytes */
#define LWNODE_MAX_APP_EUI_HEX_CHARS     ( 16U )   /**< Application EUI hex string length */
#define LWNODE_MAX_APP_KEY_HEX_CHARS     ( 32U )   /**< Application Key hex string length */
#define LWNODE_MAX_NWK_SKEY_HEX_CHARS    ( 32U )   /**< Network Session Key hex string length */
#define LWNODE_MAX_APP_SKEY_HEX_CHARS    ( 32U )   /**< Application Session Key hex string length */
/** @} */

typedef struct LwnodeHw LwnodeHw;

/**
 * @enum LwnodeBusyState
 * @brief Device operational state enumeration
 */
typedef enum {
    LWNODE_STATE_IDLE,           /**< Device is idle */
    LWNODE_STATE_JOINING,        /**< Device is performing network join */
    LWNODE_STATE_SENDING,        /**< Device is transmitting */
    LWNODE_STATE_RECV_WINDOW     /**< Device is in receive window */
} LwnodeBusyState;

/**
 * @enum LwnodeRegion
 * @brief LoRaWAN regional band configuration
 */
typedef enum
{
    LWNODE_REGION_EU868 = 0,     /**< Europe 868 MHz band */
    LWNODE_REGION_US915 = 1,     /**< United States 915 MHz band */
    LWNODE_REGION_CN470 = 2      /**< China 470 MHz band */
} LwnodeRegion;

/**
 * @enum LwnodeClass
 * @brief LoRaWAN device class
 */
typedef enum
{
    LWNODE_CLASS_A = 0,          /**< Class A: Lowest power, bidirectional receive */
    LWNODE_CLASS_C = 1           /**< Class C: Continuous listening capability */
} LwnodeClass;

/**
 * @enum LwnodePacketType
 * @brief LoRaWAN uplink transmission type
 */
typedef enum
{
    LWNODE_PACKET_UNCONFIRMED = 0, /**< No ACK, use for frequent telemetry */
    LWNODE_PACKET_CONFIRMED   = 1  /**< Retry if no ACK, use for critical events */
} LwnodePacketType;

/**
 * @enum LwnodeJoinType
 * @brief LoRaWAN network join method
 */
typedef enum
{
    LWNODE_JOIN_ABP  = 0, /**< Activation By Personalization (pre-provisioned keys) */
    LWNODE_JOIN_OTAA = 1, /**< Over-The-Air Activation (dynamic join) */
} LwnodeJoinType;

/**
 * @typedef LwnodeRxCb
 * @brief Receive data callback function signature
 * 
 * @param payload Pointer to received payload data
 * @param payloadLen Length of payload in bytes
 * @param rssi Signal strength in dBm (negative value)
 * @param snr Signal-to-noise ratio
 */
typedef void (*LwnodeRxCb)( const uint8_t * payload,
                            uint8_t payloadLen,
                            int8_t rssi,
                            int8_t snr );

/**
 * @struct LwnodeDevice
 * @brief LoRaWAN device instance and state management
 */
typedef struct LwnodeDevice
{
    const LwnodeHw * sensor;        /**< Hardware interface pointer */

    /* Device config/state */
    LwnodeJoinType joinType;        /**< Join method (OTAA or ABP) */
    LwnodeRegion region;            /**< LoRaWAN region */
    uint32_t devAddr;               /**< Device address (ABP only) */

    /* Keys stored as HEX ASCII (null-terminated) */
    char appEui[ LWNODE_MAX_APP_EUI_HEX_CHARS + 1U ];     /**< Application EUI (OTAA) */
    char appKey[ LWNODE_MAX_APP_KEY_HEX_CHARS + 1U ];     /**< Application Key (OTAA) */
    char nwkSkey[ LWNODE_MAX_NWK_SKEY_HEX_CHARS + 1U ];   /**< Network Session Key (ABP) */
    char appSkey[ LWNODE_MAX_APP_SKEY_HEX_CHARS + 1U ];   /**< Application Session Key (ABP) */

    /* radio params (optional) */
    uint8_t dataRate;               /**< “LoRaWAN datarate index (region-dependent) */
    uint8_t txPower;                /**< Transmission power in dBm */
    bool adr;                       /**< Adaptive Data Rate enabled */
    uint8_t subBand;                /**< Sub-band for US915/CN470 */

    /* last link metrics */
    int8_t lastRssi;                /**< Last received RSSI in dBm */
    int8_t lastSnr;                 /**< Last received SNR in dB */

    /* callbacks */
    LwnodeRxCb  rxCb;               /**< Receive data callback */

    /* internal: gate receive parsing during AT transactions */
    bool intEnabled;                /**< Internal: Interrupt enable flag */

    /* internal RX scratch buffer */
    uint8_t rxBuf[ LWNODE_MAX_RX_BYTES ];  /**< Internal: Receive buffer */

    bool isInitialized;              /**< Device initialization flag */
} LwnodeDevice;

/** @defgroup LwnodeInitialization Initialization and Configuration */
/** @{ */

/**
 * @brief Initialize a LWNode device instance
 * 
 * @param device Pointer to uninitialized LwnodeDevice structure
 * @param sensor Pointer to hardware interface (LwnodeHw)
 * @return true if initialization successful, false otherwise
 */
bool lwnode_init( LwnodeDevice * device, const LwnodeHw * sensor );

/** @} */

/** @defgroup LwnodeConfiguration Configuration Functions */
/** @{ */

/**
 * @brief Set the LoRaWAN regional band
 * 
 * @param device Device instance
 * @param region Target region (EU868, US915, CN470)
 * @return true if region set successfully, false otherwise
 */
bool lwnode_set_region( LwnodeDevice * device, LwnodeRegion region );

/**
 * @brief Set Application EUI (Join EUI) for OTAA
 * 
 * @param device Device instance
 * @param joinEuiHex16 Hex string (16 chars, null-terminated)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_app_eui( LwnodeDevice * device, const char * joinEuiHex16 );

/**
 * @brief Set Application Key for OTAA
 * 
 * @param device Device instance
 * @param appKeyHex32 Hex string (32 chars, null-terminated)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_app_key( LwnodeDevice * device, const char * appKeyHex32 );

/**
 * @brief Set Network Session Key for ABP
 * 
 * @param device Device instance
 * @param nwkSkeyHex32 Hex string (32 chars, null-terminated)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_nwk_skey( LwnodeDevice * device, const char * nwkSkeyHex32 );

/**
 * @brief Set Application Session Key for ABP
 * 
 * @param device Device instance
 * @param appSkeyHex32 Hex string (32 chars, null-terminated)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_app_skey( LwnodeDevice * device, const char * appSkeyHex32 );

/**
 * @brief Set Device Address for ABP
 * 
 * @param device Device instance
 * @param devAddrHex 32-bit device address
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_dev_addr( LwnodeDevice * device, uint32_t devAddrHex );

/**
 * @brief Set LoRaWAN device class
 * 
 * @param device Device instance
 * @param classType Class A or Class C
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_class( LwnodeDevice * device, LwnodeClass classType );

/**
 * @brief Set LoRa data rate (Spreading Factor)
 * 
 * @param device Device instance
 * @param dataRate Data rate value (region-dependent, typically 0-15)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_datarate( LwnodeDevice * device, uint8_t dataRate );

/**
 * @brief Set Equivalent Isotropic Radiated Power (EIRP)
 * 
 * @param device Device instance
 * @param eirp Transmission power in dBm
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_eirp( LwnodeDevice * device, uint8_t eirp );

/**
 * @brief Set sub-band for regional support (US915/CN470 only)
 * 
 * @param device Device instance
 * @param subBand Sub-band index (1-8 for US915)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_subband( LwnodeDevice * device, uint8_t subBand );

/**
 * @brief Enable or disable Adaptive Data Rate
 * 
 * @param device Device instance
 * @param adr true to enable ADR, false to disable
 * @return true if set successfully, false otherwise
 */
bool lwnode_enable_adr( LwnodeDevice * device, bool adr );

/**
 * @brief Set uplink transmission type (confirmed or unconfirmed)
 * 
 * @param device Device instance
 * @param type Packet type (confirmed or unconfirmed)
 * @return true if set successfully, false otherwise
 */
bool lwnode_set_packet_type( LwnodeDevice * device, LwnodePacketType type );

/** @} */

/** @defgroup LwnodeJoin Network Join Functions */
/** @{ */

/**
 * @brief Configure device for OTAA (Over-The-Air Activation)
 * 
 * @param device Device instance
 * @return true if configured successfully, false otherwise
 */
bool lwnode_config_otaa( LwnodeDevice * device );

/**
 * @brief Configure device for ABP (Activation By Personalization)
 * 
 * @param device Device instance
 * @return true if configured successfully, false otherwise
 */
bool lwnode_config_abp( LwnodeDevice * device );

/**
 * @brief Initialize device hardware and perform AT test
 * 
 * Performs hardware reset, verifies communication, configures join mode,
 * and applies stored credentials. Must be called before join or send operations.
 * 
 * @param device Device instance
 * @return true if initialization successful, false otherwise
 */
bool lwnode_begin( LwnodeDevice * device );

/**
 * @brief Request network join (OTAA or ABP)
 * 
 * @param device Device instance
 * @return true if join request sent successfully, false otherwise
 */
bool lwnode_join( LwnodeDevice * device );

/**
 * @brief Query current network join status
 * 
 * @param device Device instance
 * @return true if device is currently joined to network, false otherwise
 */
bool lwnode_is_joined( LwnodeDevice * device );

/** @} */

/** @defgroup LwnodeComm Communication Functions */
/** @{ */

/**
 * @brief Send binary payload over LoRaWAN
 * 
 * Encodes payload as hex ASCII and transmits via AT command.
 * 
 * @param device Device instance
 * @param data Pointer to binary payload
 * @param len Payload length (1-128 bytes)
 * @return true if transmission successful, false otherwise
 */
bool lwnode_send_packet_bytes( LwnodeDevice * device, const uint8_t * data, uint8_t len);

/**
 * @brief Sleep with periodic receive polling
 * 
 * Blocks for specified duration while polling for incoming data.
 * Processes receive callbacks during sleep if registered.
 * 
 * @param device Device instance
 * @param sleepMs Sleep duration in milliseconds
 * @return true if sleep completed successfully, false otherwise
 */
bool lwnode_sleep_ms( LwnodeDevice * device, uint32_t sleepMs);

/**
 * @brief Read received data (polling mode)
 * 
 * Retrieves next queued payload without blocking. Can be used
 * in place of callbacks for synchronous receive processing.
 * 
 * @param device Device instance
 * @param out Output buffer for payload data
 * @param outMax Maximum bytes to read
 * @param outLen Pointer to return actual bytes read
 * @return true if data available and read successfully, false otherwise
 */
bool lwnode_read_data_bytes( LwnodeDevice * device, uint8_t * out, uint16_t outMax, uint16_t * outLen);

/** @} */

/** @defgroup LwnodeCallbacks Callback Registration */
/** @{ */

/**
 * @brief Register receive data callback
 * 
 * When registered, callback is invoked for each received LoRaWAN downlink
 * with payload, length, RSSI, and SNR information.
 * 
 * @param device Device instance
 * @param callback Function pointer (NULL to unregister)
 * @return true if callback registered successfully, false otherwise
 */
bool lwnode_set_rx_cb( LwnodeDevice * device, LwnodeRxCb callback );

/** @} */

/** @defgroup LwnodeMetrics Link Quality Metrics */
/** @{ */

/**
 * @brief Get last received signal strength
 * 
 * @param device Device instance
 * @return RSSI in dBm (negative value, e.g., -120), 0 if no data received
 */
int8_t lwnode_last_rssi( const LwnodeDevice * device );

/**
 * @brief Get last received signal-to-noise ratio
 * 
 * @param device Device instance
 * @return SNR in dB (typically -20 to +10), 0 if no data received
 */
int8_t lwnode_last_snr( const LwnodeDevice * device );

/** @} */

#ifdef __cplusplus
}
#endif 

#endif /* SRC_LIB_LWNODE_H */
