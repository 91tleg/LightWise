#ifndef SRC_LIB_C4001_H
#define SRC_LIB_C4001_H

#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C"
{
#endif

typedef struct C4001Hw C4001Hw;

/**
 * @brief Sensor operating mode.
 */
typedef enum
{
    C4001_MODE_EXIST = 0,  /**< Presence / existence detection mode */
    C4001_MODE_SPEED = 1   /**< Speed / tracking mode */
} C4001Mode;

/**
 * @brief Generic ON/OFF switch type used by multiple features.
 */
typedef enum
{
    C4001_SWITCH_OFF = 0,
    C4001_SWITCH_ON = 1
} C4001Switch;

/**
 * @brief Sensor status information.
 */
typedef struct
{
    uint8_t workStatus; /**< 0 = stopped, 1 = running */
    uint8_t workMode;   /**< 0 = exist mode, 1 = speed mode */
    uint8_t initStatus; /**< 0 = not initialized, 1 = initialized */
} C4001Status;

/**
 * @brief Parsed target information (speed mode).
 */
typedef struct
{
    uint8_t  number;   /**< Number of detected targets */
    float    rangeM;   /**< Target range in meters */
    float    speedMs;  /**< Target speed in m/s */
    uint32_t energy;   /**< Signal energy */
} C4001Target;

/**
 * @brief Combined parsed data from a single frame.
 */
typedef struct
{
    C4001Status sta;    /**< Sensor status */
    bool        exist;  /**< Presence / motion detected */
    C4001Target target; /**< Target data (if available) */
} C4001AllData;

/**
 * @brief C4001 device context.
 *
 * This structure maintains cached state and protocol behavior
 * across UART transactions.
 */
typedef struct C4001Device
{
    C4001Hw * sensor;

    /* Cached target from last valid frame */
    C4001Target cache;

    /* Protocol / behavior emulation state */
    uint8_t flashCount;
    bool lastExist;

} C4001Device;

/**
 * @brief Initialize C4001 device structure.
 *
 * @param[out] device Pointer to device structure to initialize.
 * @param[in]  sensor Pointer to initialized hardware abstraction.
 *
 * @return true on success, false on invalid parameters.
 */
bool c4001_init( C4001Device * device, 
                 C4001Hw * sensor );

/**
 * @brief Deinitialize device and clear internal state.
 *
 * @param[in,out] device Pointer to device.
 *
 * @return true on success.
 */
bool c4001_deinit( C4001Device * device );

/**
 * @brief Detect whether a C4001 sensor is connected and responsive.
 *
 * @param[in,out] device Pointer to initialized device.
 *
 * @return true if sensor is detected, false otherwise.
 */
bool c4001_connect( C4001Device * device );

/**
 * @brief Retrieve current sensor status.
 *
 * @param[in,out] device Pointer to device.
 * @param[out]    outStatus Pointer to status structure.
 *
 * @return true if status was retrieved successfully.
 */
bool c4001_get_status( C4001Device * device, 
                       C4001Status * outStatus );

/**
 * @brief Check for motion / presence detection.
 *
 * @param[in,out] device Pointer to device.
 * @param[out]    outMotion True if motion is currently detected.
 *
 * @return true on successful read.
 */
bool c4001_motion_detected( C4001Device * device, 
                            bool * outMotion );

/**
 * @brief Set sensor operating mode.
 *
 * @param[in,out] device Pointer to device.
 * @param[in]     mode Desired sensor mode.
 *
 * @return true if command succeeded.
 */
bool c4001_set_sensor_mode( C4001Device * device, C4001Mode mode );

/* Sensitivity configuration */

bool c4001_set_trig_sensitivity( C4001Device * device,
                                 uint8_t sensitivity );

bool c4001_get_trig_sensitivity( C4001Device * device,
                                 uint8_t * outSens );

bool c4001_set_keep_sensitivity( C4001Device * device,
                                 uint8_t sensitivity );

bool c4001_get_keep_sensitivity( C4001Device * dev, 
                                 uint8_t * outSens );

/* Timing configuration */

bool c4001_set_delay( C4001Device * device, 
                      uint8_t trig, 
                      uint16_t keep );

bool c4001_get_delay( C4001Device * device, 
                      uint16_t * outMs );

bool c4001_get_keep_timeout_ms( C4001Device * device,  
                                uint16_t * outMs );

/* Detection range configuration */

bool c4001_set_detection_range( C4001Device * device, 
                                uint16_t minCm, 
                                uint16_t maxCm, 
                                uint16_t trigCm );

bool c4001_get_trig_range_cm( C4001Device * dev, 
                              uint16_t * outCm );

bool c4001_get_min_range_cm( C4001Device * device, 
                             uint16_t * outCm );

bool c4001_get_max_range_cm( C4001Device * dev, 
                             uint16_t * outCm );

/* Target data */

bool c4001_update_target( C4001Device * device, 
                          uint8_t *outNumber );

bool c4001_get_target( C4001Device * dev, 
                       C4001Target * outTarget );

/* Detection threshold */

bool c4001_set_detect_threshold( C4001Device * device, 
                                 uint16_t minCm, 
                                 uint16_t maxCm, 
                                 uint16_t thres );

bool c4001_get_threshold( C4001Device * device, 
                          uint16_t * outThres );

/* Micro-motion (fretting) detection */

bool c4001_set_micro_motion( C4001Device * device, 
                             C4001Switch st );

bool c4001_get_micro_motion( C4001Device * device, 
                             C4001Switch * outSt );

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
bool c4001_set_pwm( C4001Device * device,
                    uint8_t pwm1,
                    uint8_t pwm2,
                    uint8_t timer );

/**
 * @brief Configure sensor GPIO output polarity (UART mode only)
 *
 * @param[in,out] device Pointer to initialized C4001 device structure.
 * @param[in] value     Polarity: 0 = active-low, 1 = active-high
 *
 * @return true  If command sent and sensor accepted configuration.
 * @return false On invalid parameter or write failure.
 */
bool c4001_set_gpio_polarity( C4001Device * device,
                              uint8_t value );

#ifdef __cplusplus
}
#endif

#endif /* SRC_LIB_C4001_H */
