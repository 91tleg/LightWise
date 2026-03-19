#ifndef SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP
#define SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP 

#include <cstdint>
#include <cstddef>

namespace lorawan
{

    /**
     * @brief  Pure virtual interface for a LoRaWAN sensor module.
     */
    class LorawanSensor
    {
    public:
        static constexpr size_t kAppEuiHexChars  { 16U }; /**< App EUI length */
        static constexpr size_t kAppKeyHexChars  { 32U }; /**< App Key length */
        static constexpr size_t kNwkSKeyHexChars { 32U }; /**< Network Session Key length */
        static constexpr size_t kAppSKeyHexChars { 32U }; /**< App Session Key length */

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

        [[nodiscard]] virtual bool begin() noexcept = 0;
        [[nodiscard]] virtual bool join() noexcept = 0;
        [[nodiscard]] virtual bool isJoined() noexcept = 0;
        [[nodiscard]] virtual bool setRegion( Region region ) noexcept = 0;
        [[nodiscard]] virtual bool setAppEui( const char * appEui ) noexcept = 0;
        [[nodiscard]] virtual bool setAppKey( const char * appKey ) noexcept = 0;
        [[nodiscard]] virtual bool setNwkSkey( const char * nwkSkey ) noexcept = 0;
        [[nodiscard]] virtual bool setAppSkey( const char * appSkey ) noexcept = 0;
        [[nodiscard]] virtual bool setClass( DeviceClass classType ) noexcept = 0;
        [[nodiscard]] virtual bool setDatarate( uint8_t dataRate ) noexcept = 0;
        [[nodiscard]] virtual bool setEirp( uint8_t eirp ) noexcept = 0;
        [[nodiscard]] virtual bool setSubband( uint8_t subBand ) noexcept = 0;
        [[nodiscard]] virtual bool enableAdr( bool adr ) noexcept = 0;
        [[nodiscard]] virtual bool setPacketType( PacketType type ) noexcept = 0;
        [[nodiscard]] virtual bool sendPacket( const uint8_t * data, uint8_t len ) noexcept = 0;
        [[nodiscard]] virtual bool sleepMs( uint32_t ms ) noexcept = 0;
        [[nodiscard]] virtual bool setRxCb( RxCallback callback ) noexcept = 0;

    protected:
        LorawanSensor()                                   = default;
        LorawanSensor( const LorawanSensor & )            = default;
        LorawanSensor &operator=( const LorawanSensor & ) = default;
        LorawanSensor( LorawanSensor && )                 = default;
        LorawanSensor &operator=( LorawanSensor && )      = default;
    };

} /* namespace lorawan */

#endif /* SRC_LIB_LORAWAN_LORAWAN_SENSOR_HPP */
