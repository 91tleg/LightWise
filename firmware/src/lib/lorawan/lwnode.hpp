#ifndef SRC_LIB_LORAWAN_LWNODE_HPP
#define SRC_LIB_LORAWAN_LWNODE_HPP

#include <cstdint>
#include <cstddef>

#include "lorawan_sensor.hpp"

typedef struct LwnodeHw LwnodeHw;

namespace lorawan
{
    class Lwnode final : public LorawanSensor
    {
    public:
        explicit constexpr Lwnode( LwnodeHw * const sensor )
            : sensor_( sensor ),
            joinMode_( JoinMode::OTAA ),
            region_( Region::US915 ),
            devAddr_( 0U ),
            appEui_{},
            appKey_{},
            nwkSkey_{},
            appSkey_{},
            dataRate_( 0U ),
            txPower_( 14U ),
            adr_( false ),
            subBand_( 1U ),
            lastRssi_( 0 ),
            lastSnr_( 0 ),
            rxCb_( nullptr ),
            intEnabled_( true ),
            rxBuf_{},
            isInitialized_( false )
        {

        }

        /** @defgroup LwnodeInitialization Initialization and Configuration */
        /** @{ */

        /**
         * @brief Initialize a LWNode device instance
         * 
         * @return true if initialization successful, false otherwise
         */
        bool init() override;

        /** @} */

        /** @defgroup LwnodeConfiguration Configuration Functions */
        /** @{ */

        /**
         * @brief Set the LoRaWAN regional band
         * 
         * @param region Target region (EU868, US915, CN470)
         * @return true if region set successfully, false otherwise
         */
        bool setRegion( Region region );

        /**
         * @brief Set Application EUI (Join EUI) for OTAA
         * 
         * @param joinEuiHex16 Hex string (16 chars, null-terminated)
         * @return true if set successfully, false otherwise
         */
        bool setAppEui( const char * joinEuiHex16 ) override;

        /**
         * @brief Set Application Key for OTAA
         * 
         * @param appKeyHex32 Hex string (32 chars, null-terminated)
         * @return true if set successfully, false otherwise
         */
        bool setAppKey( const char * appKeyHex32 ) override;

        /**
         * @brief Set Network Session Key for ABP
         * 
         * @param nwkSkeyHex32 Hex string (32 chars, null-terminated)
         * @return true if set successfully, false otherwise
         */
        bool setNwkSkey( const char * nwkSkeyHex32 ) override;

        /**
         * @brief Set Application Session Key for ABP
         * 
         * @param appSkeyHex32 Hex string (32 chars, null-terminated)
         * @return true if set successfully, false otherwise
         */
        bool setAppSkey( const char * appSkeyHex32 ) override;

        /**
         * @brief Set Device Address for ABP
         * 
         * @param devAddrHex 32-bit device address
         * @return true if set successfully, false otherwise
         */
        bool setDevAddr( uint32_t devAddrHex );

        /**
         * @brief Set LoRaWAN device class
         * 
         * @param classType Class A or Class C
         * @return true if set successfully, false otherwise
         */
        bool setClass( DeviceClass classType );

        /**
         * @brief Set LoRa data rate (Spreading Factor)
         * 
         * @param dataRate Data rate value (region-dependent, typically 0-15)
         * @return true if set successfully, false otherwise
         */
        bool setDatarate( uint8_t dataRate );

        /**
         * @brief Set Equivalent Isotropic Radiated Power (EIRP)
         * 
         * @param eirp Transmission power in dBm
         * @return true if set successfully, false otherwise
         */
        bool setEirp( uint8_t eirp );

        /**
         * @brief Set sub-band for regional support (US915/CN470 only)
         * 
         * @param subBand Sub-band index (1-8 for US915)
         * @return true if set successfully, false otherwise
         */
        bool setSubband( uint8_t subBand );

        /**
         * @brief Enable or disable Adaptive Data Rate
         * 
         * @param adr true to enable ADR, false to disable
         * @return true if set successfully, false otherwise
         */
        bool enableAdr( bool adr );

        /**
         * @brief Set uplink transmission type (confirmed or unconfirmed)
         * 
         * @param type Packet type (confirmed or unconfirmed)
         * @return true if set successfully, false otherwise
         */
        bool setPacketType( PacketType type );

        /** @} */

        /** @defgroup LwnodeJoin Network Join Functions */
        /** @{ */

        /**
         * @brief Configure device for OTAA (Over-The-Air Activation)
         * 
         * @return true if configured successfully, false otherwise
         */
        bool configOtaa();

        /**
         * @brief Configure device for ABP (Activation By Personalization)
         * 
         * @return true if configured successfully, false otherwise
         */
        bool configAbp();

        /**
         * @brief Initialize device hardware and perform AT test
         * 
         * Performs hardware reset, verifies communication, configures join mode,
         * and applies stored credentials. Must be called before join or send operations.
         * 
         * @return true if initialization successful, false otherwise
         */
        bool begin();

        /**
         * @brief Request network join (OTAA or ABP)
         * 
         * @return true if join request sent successfully, false otherwise
         */
        bool join();

        /**
         * @brief Query current network join status
         * 
         * @return true if device is currently joined to network, false otherwise
         */
        bool isJoined();

        /** @} */

        /** @defgroup LwnodeComm Communication Functions */
        /** @{ */

        /**
         * @brief Send binary payload over LoRaWAN
         * 
         * Encodes payload as hex ASCII and transmits via AT command.
         * 
         * @param data Pointer to binary payload
         * @param len Payload length (1-128 bytes)
         * @return true if transmission successful, false otherwise
         */
        bool sendPacket( const uint8_t * data, uint8_t len ) override;

        /**
         * @brief Sleep with periodic receive polling
         * 
         * Blocks for specified duration while polling for incoming data.
         * Processes receive callbacks during sleep if registered.
         * 
         * @param sleepMs Sleep duration in milliseconds
         * @return true if sleep completed successfully, false otherwise
         */
        bool sleepMs( uint32_t sleepMs);

        /**
         * @brief Read received data (polling mode)
         * 
         * Retrieves next queued payload without blocking. Can be used
         * in place of callbacks for synchronous receive processing.
         * 
         * @param out Output buffer for payload data
         * @param outMax Maximum bytes to read
         * @param outLen Pointer to return actual bytes read
         * @return true if data available and read successfully, false otherwise
         */
        bool readData( uint8_t * out, uint16_t outMax, uint16_t * outLen );

        /** @} */

        /** @defgroup LwnodeCallbacks Callback Registration */
        /** @{ */

        /**
         * @brief Register receive data callback
         * 
         * When registered, callback is invoked for each received LoRaWAN downlink
         * with payload, length, RSSI, and SNR information.
         * 
         * @param callback Function pointer (NULL to unregister)
         * @return true if callback registered successfully, false otherwise
         */
        bool setRxCb( RxCallback callback );

        /** @} */

        /** @defgroup LwnodeMetrics Link Quality Metrics */
        /** @{ */

        /**
         * @brief Get last received signal strength
         * 
         * @return RSSI in dBm (negative value, e.g., -120), 0 if no data received
         */
        int8_t lastRssi();

        /**
         * @brief Get last received signal-to-noise ratio
         * 
         * @return SNR in dB (typically -20 to +10), 0 if no data received
         */
        int8_t lastSnr();

        /** @} */

    private:
        LwnodeHw * const sensor_;                    /**< Hardware interface pointer */
        static constexpr size_t kMaxRxBytes = 256U;  /**< Maximum receive buffer size in bytes */

        /* Device config/state */
        JoinMode joinMode_;  /**< Join method (OTAA or ABP) */
        Region region_;      /**< LoRaWAN region */
        uint32_t devAddr_;   /**< Device address (ABP only) */

        /* HEX ASCII Keys (null-terminated) */
        char appEui_[ kAppEuiHexChars + 1U ];    /**< Application EUI (OTAA) */
        char appKey_[ kAppKeyHexChars + 1U ];    /**< Application Key (OTAA) */
        char nwkSkey_[ kNwkSKeyHexChars + 1U ];  /**< Network Session Key (ABP) */
        char appSkey_[ kAppSKeyHexChars + 1U ];  /**< Application Session Key (ABP) */

        /* radio params */
        uint8_t dataRate_;              /**< “LoRaWAN datarate index (region-dependent) */
        uint8_t txPower_;               /**< Transmission power in dBm */
        bool adr_;                      /**< Adaptive Data Rate enabled */
        uint8_t subBand_;               /**< Sub-band for US915/CN470 */

        /* last link metrics */
        int8_t lastRssi_;               /**< Last received RSSI in dBm */
        int8_t lastSnr_;                /**< Last received SNR in dB */

        RxCallback rxCb_;               /**< Receive data callback */

        bool intEnabled_;               /**< Internal: Interrupt enable flag */
        uint8_t rxBuf_[ kMaxRxBytes ];  /**< Internal: Receive buffer */

        bool isInitialized_;            /**< Device initialization flag */

        bool atTest();
        bool writeAtBytes( const uint8_t * data, uint16_t len );
        bool readAckBytes( uint16_t * outLen );
        bool sendAtCmd( const char * cmdAscii, char * ackBuf, size_t ackCap );
        static bool ackEquals( const char * ack, const char * expected );
        bool readLoraData( uint16_t * outLen );
        bool processRecvFrames( const uint8_t * buf, uint16_t len );
        bool readAckWithYield( uint16_t * outLen );
    };
}
#endif /* SRC_LIB_LORAWAN_LWNODE_HPP */