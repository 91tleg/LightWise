#ifndef SRC_LIB_MMWAVE_C4001_H
#define SRC_LIB_MMWAVE_C4001_H

#include <cstdint>
#include <cstddef>
#include "mmwave_sensor.hpp"

typedef struct C4001Hw C4001Hw;

namespace mmwave
{
    class C4001 final : public MmwaveSensor
    {
    public:

        explicit constexpr C4001( C4001Hw * const sensor )
            : sensor_( sensor ), 
              cache_(), 
              flashCount_( 0U ),
              lastExist_( false ),
              isInitialized_( false )
        {

        }

        /**
         * @brief Initialize C4001 device structure.
         *
         * @param[out] device Pointer to device structure to initialize.
         * @param[in]  sensor Pointer to initialized hardware abstraction.
         *
         * @return true on success, false on invalid parameters.
         */
        bool init() override;

        /**
         * @brief Detect whether a C4001 sensor is connected and responsive.
         *
         * @param[in,out] device Pointer to initialized device.
         *
         * @return true if sensor is detected, false otherwise.
         */
        bool connect() override;

        /**
         * @brief Retrieve current sensor status.
         *
         * @param[in,out] device Pointer to device.
         * @param[out]    outStatus Pointer to status structure.
         *
         * @return true if status was retrieved successfully.
         */
        bool getStatus( Status & status );

        /**
         * @brief Check for motion / presence detection.
         *
         * @param[in,out] device Pointer to device.
         * @param[out]    outMotion True if motion is currently detected.
         *
         * @return true on successful read.
         */
        bool motionDetected( bool & motion ) override;

        /**
         * @brief Set sensor operating mode.
         *
         * @param[in,out] device Pointer to device.
         * @param[in]     mode Desired sensor mode.
         *
         * @return true if command succeeded.
         */
        bool setSensorMode( Mode mode ) override;

        /* Sensitivity configuration */

        bool setTrigSensitivity( uint8_t sensitivity ) override;

        bool getTrigSensitivity( uint8_t & sensitivity );

        bool setKeepSensitivity( uint8_t sensitivity ) override;

        bool getKeepSensitivity( uint8_t & sensitivity );

        /* Timing configuration */

        bool setDelay( uint8_t trig, uint16_t keep ) override;

        bool getDelay( uint16_t & delayMs );

        bool getKeepTimeout( uint16_t & timeoutMs );

        /* Detection range configuration */

        bool setDetectionRange( uint16_t minCm, 
                                uint16_t maxCm, 
                                uint16_t trigCm ) override;

        bool getTrigRangeCm( uint16_t & trigCm );

        bool getMinRangeCm( uint16_t & minCm );

        bool getMaxRangeCm( uint16_t & maxCm );

        /* Target data */

        bool updateTarget( uint8_t & outNumber );

        bool getTarget( Target & outTarget );

        /* Detection threshold */

        bool setDetectThreshold( uint16_t minCm, 
                                 uint16_t maxCm, 
                                 uint16_t thres );

        bool getThreshold( uint16_t & thres );

        /* Micro-motion (fretting) detection */

        bool setMicroMotion( bool enable );

        bool getMicroMotion( bool & isEnabled );

        /**
         * @brief Configure the sensor PWM output (UART mode only)
         *
         * @param[in,out] device Pointer to initialized C4001 device structure.
         * @param[in] pwm1      Duty cycle for state 1 (0–100 %)
         * @param[in] pwm2      Duty cycle for state 2 (0–100 %)
         * @param[in] timer     Timing parameter (device-specific, usually ms units)
         *
         * @return true  If command sent and sensor accepted configuration.
         * @return false On invalid parameters or write failure.
         */
        bool setPwm( uint8_t pwm1, uint8_t pwm2, uint8_t timer );

        /**
         * @brief Configure sensor GPIO output polarity (UART mode only)
         *
         * @param[in,out] device Pointer to initialized C4001 device structure.
         * @param[in] value     Polarity: 0 = active-low, 1 = active-high
         *
         * @return true  If command sent and sensor accepted configuration.
         * @return false On invalid parameter or write failure.
         */
        bool setGpioPolarity( uint8_t value );
    private:
        C4001Hw * sensor_;
        Target cache_;
        uint8_t flashCount_;
        bool lastExist_;
        bool isInitialized_;

        /* Response parsing structure */
        struct ResponseData
        {
            bool status;
            float response1;
            float response2;
            float response3;
        };

        bool writeCmd( const char * const cmd );
        bool sensorStop();
        bool cmdStopSaveStart( const char * const cmd1, 
                               const char * const cmd2, 
                               uint8_t count );
        bool queryResponse( const char * const cmd,
                            uint8_t expectedResponses,
                            ResponseData & data );
        static bool parseResponse( const uint8_t * buf,
                                   size_t len,
                                   uint8_t count,
                                   ResponseData & data );

        static bool parseDfdmd( const uint8_t * const buf, 
                                size_t len, 
                                size_t pos, 
                                Target & target, 
                                bool & exist );

        static bool parseFrame( const uint8_t * const buf,
                                size_t len,
                                Status & status,
                                bool & exist,
                                Target & target,
                                bool & hasTarget );
    };

} /* namespace mmwave */

#endif /* SRC_LIB_MMWAVE_C4001_H */
