#ifndef SRC_LIB_MMWAVE_MMWAVE_SENSOR_HPP
#define SRC_LIB_MMWAVE_MMWAVE_SENSOR_HPP

#include <cstdint>

namespace mmwave
{

    enum class Mode : uint8_t 
    {
        PRESENCE = 0, /**< Simple occupancy/existence detection */
        TRACKING = 1  /**< Speed, range, and direction tracking */
    };

    /**
     * @brief High-level status of the sensor hardware.
     */
    struct Status 
    {
        bool isRunning;
        bool isInitialized;
        Mode activeMode;
    };

    /**
     * @brief Physical characteristics of a detected object.
     */
    struct Target 
    {
        uint8_t  count;      /**< Number of targets in field of view */
        float    distanceM;  /**< Distance in meters */
        float    velocityMs; /**< Speed in meters per second */
        uint32_t signalStrength; /**< Raw energy or SNR */
    };

    /**
     * @brief Unified data structure for a single sensing frame.
     */
    struct SensorData 
    {
        Status status;
        bool   isTargetPresent;
        Target target;
    };

    class MmwaveSensor
    {
    public:
        virtual ~MmwaveSensor() = default;

        [[nodiscard]] virtual bool connect() = 0;

        [[nodiscard]] virtual bool setSensorMode( Mode mode ) = 0;

        [[nodiscard]] virtual bool setDetectionRange( uint16_t min,
                                                      uint16_t max,
                                                      uint16_t trig ) = 0;

        [[nodiscard]] virtual bool setTrigSensitivity( uint8_t sensitivity ) = 0;

        [[nodiscard]] virtual bool setKeepSensitivity( uint8_t sensitivity ) = 0;

        [[nodiscard]] virtual bool setDelay( uint8_t trig,
                                             uint16_t keep ) = 0;

        [[nodiscard]] virtual bool motionDetected( bool & moiton ) = 0;

        [[nodiscard]] virtual bool setGpioPolarity( uint8_t value ) = 0;

    protected:
        MmwaveSensor()                                  = default;
        MmwaveSensor( const MmwaveSensor & )            = default;
        MmwaveSensor &operator=( const MmwaveSensor & ) = default;
        MmwaveSensor( MmwaveSensor && )                 = default;
        MmwaveSensor &operator=( MmwaveSensor && )      = default;
    };

} /* namespace mmwave */

#endif /* SRC_LIB_MMWAVE_MMWAVE_SENSOR_HPP */
