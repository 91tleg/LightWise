#ifndef SRC_LIB_TH_DHT11_HPP
#define SRC_LIB_TH_DHT11_HPP

#include <cstdint>

#include "th_sensor.hpp"

typedef struct Dht11Hw Dht11Hw;

namespace th
{
    /**
     * @class Dht11
     * @brief DHT11 temperature and humidity sensor driver.
     * 
     * Implements the THSensor interface for the DHT11 digital temperature
     * and humidity sensor. Handles initialization and reading of sensor data
     * through a single-wire digital protocol.
     */
    class Dht11 : public THSensor
    {
    public:
        /**
         * @brief Constructs a DHT11 sensor instance.
         * 
         * @param sensor Pointer to the hardware config structure for the DHT11 sensor.
         */
        explicit constexpr Dht11( const Dht11Hw * const sensor )
            : sensor_( sensor ),
              isInitialized_( false )
        {

        }

        /**
         * @brief Initializes the DHT11 sensor.
         * 
         * @return true if initialization successful, false otherwise.
         */
        bool init() override;

        /**
         * @brief Reads temperature and humidity from the sensor.
         * 
         * @param[out] temperature The temperature value in degrees Celsius.
         * @param[out] humidity The relative humidity value in percentage.
         * @return true if read successful, false otherwise.
         */
        bool read( uint8_t & temperature, 
                   uint8_t & humidity ) const override;
        
    private:
        const Dht11Hw * const sensor_;  /**< Pointer to hardware configuration structure */
        bool isInitialized_;            /**< Initialization status flag */

        /**
         * @brief Sends the start signal to initiate sensor communication.
         * 
         * @return true if start signal sent successfully, false otherwise.
         */
        bool startSignal() const;

        /**
         * @brief Reads raw 5-byte data from the sensor.
         * 
         * @param[out] data Array of 5 bytes containing sensor data and checksum.
         * @return true if read successful and checksum valid, false otherwise.
         */
        bool readRaw( uint8_t data[ 5 ] ) const;

        /**
         * @brief Reads a single byte from the sensor.
         * 
         * @param[out] byteOut The byte read from the sensor.
         * @return true if byte read successfully, false otherwise.
         */
        bool readByte( uint8_t & byteOut ) const;

        /**
         * @brief Waits for a specific signal level with timeout.
         * 
         * @param level The expected signal level (0 or 1).
         * @param timeoutUs Timeout duration in microseconds.
         * @return true if expected level detected, false on timeout or error.
         */
        bool waitLevel( uint8_t level, uint32_t timeoutUs ) const;
    };
} /* namespace th */

#endif /* SRC_LIB_TH_DHT11_HPP */
