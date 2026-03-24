#ifndef SRC_LIB_TH_DHT11_HPP
#define SRC_LIB_TH_DHT11_HPP

#include <cstdint>
#include <span>

#include "th_sensor.hpp"

typedef struct Dht11Hw Dht11Hw;

namespace th
{

    /**
     * @class Dht11
     * @brief DHT11 temperature and humidity sensor driver.
     * 
     * Implements the THSensor interface for the DHT11 digital temperature
     * and humidity sensor. Handles reading sensor data through a single-wire
     * digital protocol.
     */
    class Dht11 final : public THSensor
    {
    public:
        /**
         * @brief Constructs a DHT11 sensor instance.
         * 
         * @param sensor Reference to the hardware config structure for the DHT11 sensor.
         */
        explicit constexpr Dht11( const Dht11Hw & sensor )
            : sensor_ { sensor }
        {

        }

        /**
         * @brief Reads temperature and humidity from the sensor.
         * 
         * @param[out] temperature The temperature value in degrees Celsius.
         * @param[out] humidity The relative humidity value in percentage.
         * @return true if read successful, false otherwise.
         */
        [[nodiscard]] bool read( uint8_t & temperature, 
                                 uint8_t & humidity ) const noexcept override;

    private:
        const Dht11Hw & sensor_;  /**< Reference to hardware configuration structure */

        /**
         * @brief Sends the start signal to initiate sensor communication.
         * 
         * @return true if start signal sent successfully, false otherwise.
         */
        [[nodiscard]] bool startSignal() const noexcept;

        /**
         * @brief Reads raw 5-byte data from the sensor.
         *
         * @param data Span of 5 bytes written with raw sensor data and checksum
         *             on success. Contents are undefined on failure.
         * @return true if read successful and checksum valid, false otherwise.
         */
        [[nodiscard]] bool readRaw( std::span< uint8_t, 5U > data ) const noexcept;

        /**
         * @brief Reads a single byte from the sensor.
         * 
         * @param[out] byteOut The byte read from the sensor.
         * @return true if byte read successfully, false otherwise.
         */
        [[nodiscard]] bool readByte( uint8_t & byteOut ) const noexcept;

        /**
         * @brief Waits for a specific signal level with timeout.
         * 
         * @param level The expected signal level (0 or 1).
         * @param timeoutUs Timeout duration in microseconds.
         * @return true if expected level detected, false on timeout or error.
         */
        [[nodiscard]] bool waitLevel( uint8_t level, uint32_t timeoutUs ) const noexcept;
    };

} /* namespace th */

#endif /* SRC_LIB_TH_DHT11_HPP */
