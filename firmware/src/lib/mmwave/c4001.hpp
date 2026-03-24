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

        explicit constexpr C4001( C4001Hw & sensor )
            : sensor_ { sensor }
            , cache_ {}
            , flashCount_ { 0U }
            , lastExist_ { false }
        {

        }

        /**
         * @brief Detect whether a C4001 sensor is connected and responsive.
         *
         * @param[in,out] device Pointer to initialized device.
         *
         * @return true if sensor is detected, false otherwise.
         */
        [[nodiscard]] bool connect() override;

        /**
         * @brief Retrieve current sensor status.
         *
         * @param[in,out] device Pointer to device.
         * @param[out]    outStatus Pointer to status structure.
         *
         * @return true if status was retrieved successfully.
         */
        [[nodiscard]] bool getStatus( Status & status );

        /**
         * @brief Check for motion / presence detection.
         *
         * @param[in,out] device Pointer to device.
         * @param[out]    outMotion True if motion is currently detected.
         *
         * @return true on successful read.
         */
        [[nodiscard]] bool motionDetected( bool & motion ) override;

        /**
         * @brief Set sensor operating mode.
         *
         * @param[in,out] device Pointer to device.
         * @param[in]     mode Desired sensor mode.
         *
         * @return true if command succeeded.
         */
        [[nodiscard]] bool setSensorMode( Mode mode ) override;

        /* Sensitivity configuration */

        [[nodiscard]] bool setTrigSensitivity( uint8_t sensitivity ) override;

        [[nodiscard]] bool getTrigSensitivity( uint8_t & sensitivity );

        [[nodiscard]] bool setKeepSensitivity( uint8_t sensitivity ) override;

        [[nodiscard]] bool getKeepSensitivity( uint8_t & sensitivity );

        /* Timing configuration */

        [[nodiscard]] bool setDelay( uint8_t trig, uint16_t keep ) override;

        [[nodiscard]] bool getDelay( uint16_t & delayMs );

        [[nodiscard]] bool getKeepTimeout( uint16_t & timeoutMs );

        /* Detection range configuration */

        [[nodiscard]] bool setDetectionRange( uint16_t minCm, 
                                              uint16_t maxCm, 
                                              uint16_t trigCm ) override;

        [[nodiscard]] bool getTrigRangeCm( uint16_t & trigCm );

        [[nodiscard]] bool getMinRangeCm( uint16_t & minCm );

        [[nodiscard]] bool getMaxRangeCm( uint16_t & maxCm );

        /* Target data */

        [[nodiscard]] bool updateTarget( uint8_t & outNumber );

        void getTarget( Target & outTarget );

        /* Detection threshold */

        [[nodiscard]] bool setDetectThreshold( uint16_t minCm, 
                                               uint16_t maxCm, 
                                               uint16_t thres );

        [[nodiscard]] bool getThreshold( uint16_t & thres );

        /* Micro-motion (fretting) detection */

        [[nodiscard]] bool setMicroMotion( bool enable );

        [[nodiscard]] bool getMicroMotion( bool & isEnabled );

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
        [[nodiscard]] bool setPwm( uint8_t pwm1, uint8_t pwm2, uint8_t timer );

        /**
         * @brief Configure sensor GPIO output polarity (UART mode only)
         *
         * @param[in,out] device Pointer to initialized C4001 device structure.
         * @param[in] value     Polarity: 0 = active-low, 1 = active-high
         *
         * @return true  If command sent and sensor accepted configuration.
         * @return false On invalid parameter or write failure.
         */
        [[nodiscard]] bool setGpioPolarity( uint8_t value );

    private:
        C4001Hw & sensor_;
        Target cache_;
        uint8_t flashCount_;
        bool lastExist_;

        /* Response parsing structure */
        struct ResponseData
        {
            bool status;
            float response1;
            float response2;
            float response3;
        };

        [[nodiscard]] bool writeCmd( const char * const cmd );
        [[nodiscard]] bool sensorStop();
        [[nodiscard]] bool cmdStopSaveStart( const char * const cmd1, 
                                             const char * const cmd2, 
                                             uint8_t count );
        [[nodiscard]] bool queryResponse( const char * const cmd,
                                          uint8_t expectedResponses,
                                          ResponseData & data );
        [[nodiscard]] static bool parseResponse( const uint8_t * buf,
                                                 size_t len,
                                                 uint8_t count,
                                                 ResponseData & data );

        [[nodiscard]] static bool parseDfdmd( const uint8_t * const buf, 
                                              size_t len, 
                                              size_t pos, 
                                              Target & target, 
                                              bool & exist );

        [[nodiscard]] static bool parseFrame( const uint8_t * const buf,
                                              size_t len,
                                              Status & status,
                                              bool & exist,
                                              Target & target,
                                              bool & hasTarget );
    };

} /* namespace mmwave */

#endif /* SRC_LIB_MMWAVE_C4001_H */
