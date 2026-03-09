#ifndef SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP
#define SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP 

#include <cstdint>
#include <cstddef>

namespace lorawan
{
    class LorawanSensor
    {
    public:
        static constexpr size_t kAppEuiHexChars = 16U;  /**< App EUI length */
        static constexpr size_t kAppKeyHexChars = 32U;  /**< App Key length */
        static constexpr size_t kNwkSKeyHexChars = 32U; /**< Network Session Key length */
        static constexpr size_t kAppSKeyHexChars = 32U; /**< App Session Key length */

        /** @brief Device operational states */
        enum class State : uint8_t 
        {
            IDLE,
            JOINING,
            SENDING,
            RECV_WINDOW,
        };

        /** @brief Regional frequency bands */
        enum class Region : uint8_t
        {
            EU868 = 0,
            US915,
            CN470,
        };

        /** @brief LoRaWAN Device Classes */
        enum class DeviceClass : uint8_t
        {
            A = 0,
            C
        };

        /** @brief Uplink transmission reliability */
        enum class PacketType : uint8_t
        {
            UNCONFIRMED = 0,
            CONFIRMED
        };

        /** @brief Network activation methods */
        enum class JoinMode : uint8_t
        {
            ABP = 0,
            OTAA
        };

        /** @brief Callback for downlink data */
        typedef void (*RxCallback)( const uint8_t * payload, uint8_t len, int8_t rssi, int8_t snr );

        virtual ~LorawanSensor() = default;

        virtual bool init() = 0;
        virtual bool begin() = 0;
        virtual bool join() = 0;
        virtual bool isJoined() = 0;
        virtual bool setRegion( Region region ) = 0;
        virtual bool setAppEui( const char * appEui ) = 0;
        virtual bool setAppKey( const char * appKey ) = 0;
        virtual bool setNwkSkey( const char * nwkSkey ) = 0;
        virtual bool setAppSkey( const char * appSkey ) = 0;
        virtual bool setClass( DeviceClass classType ) = 0;
        virtual bool setDatarate( uint8_t dataRate ) = 0;
        virtual bool setEirp( uint8_t eirp ) = 0;
        virtual bool setSubband( uint8_t subBand ) = 0;
        virtual bool enableAdr( bool adr ) = 0;
        virtual bool setPacketType( PacketType type ) = 0;
        virtual bool sendPacket( const uint8_t * data, uint8_t len ) = 0;
    };
} /* namespace lorawan */

#endif /* SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP */