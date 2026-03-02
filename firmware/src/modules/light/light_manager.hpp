/**
 * @file light_manager.hpp
 * @brief Light intensity manager for controlling streetlight brightness.
 * 
 * Provides a Manager class for smoothly ramping light intensity up or down
 * in discrete steps over time.
 */

#ifndef SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP
#define SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP

#include <cstdint>

namespace light
{
    class LightSensor;
    /**
     * @class Manager
     * @brief Manages light intensity transitions with smooth ramping.
     * 
     * The Manager class controls the brightness of a light sensor by ramping
     * the intensity from its current value to a target value in discrete steps.
     * The stepping rate is configurable to allow smooth transitions.
     */
    class Manager
    {
    public:
        /**
         * @brief Constructs a Manager instance.
         * 
         * @param led Reference to a LightSensor object to control.
         * @param stepsPerSecond Number of brightness steps to perform per second.
         */
        explicit Manager( LightSensor & led, uint8_t stepsPerSecond );

        /**
         * @brief Sets a new target brightness and update rate.
         * 
         * Initiates a ramp transition from the current brightness to the target
         * brightness. The transition occurs in discrete steps with the specified
         * stepping rate.
         * 
         * @param target The target brightness level (0-255).
         * @param stepsPerSecond The number of brightness steps per second.
         */
        void setTarget( uint8_t target, uint8_t stepsPerSecond );

        /**
         * @brief Performs one step of the brightness transition.
         * 
         * Should be called periodically to advance the brightness ramping.
         * 
         * @return true if currently ramping, false otherwise.
         */
        bool step();

        /**
         * @brief Checks if the light is currently ramping to a target brightness.
         * 
         * @return true if ramping is in progress, false if at target.
         */
        bool isRamping() const;

        /**
         * @brief Gets the current target brightness level.
         * 
         * @return The target brightness value (0-255).
         */
        uint8_t getTarget() const;

        /**
         * @brief Gets the time interval between steps in milliseconds.
         * 
         * @return The step interval in milliseconds based on stepsPerSecond.
         */
        uint32_t stepIntervalMs() const;

    private:
        LightSensor & led_;  /**< Reference to the led being controlled. */
        uint8_t target_;  /**< Target brightness level. */
        uint8_t stepsPerSecond_;  /**< Number of brightness steps per second. */
        bool ramping_;  /**< Flag indicating if currently ramping to target. */

        /**
         * @brief Clamps a value between low and high bounds.
         * 
         * @param value The value to clamp.
         * @param low The lower bound (inclusive).
         * @param high The upper bound (inclusive).
         * @return The clamped value.
         */
        uint8_t clamp( uint8_t value, uint8_t low, uint8_t high );
    };
} /* namespace light */

#endif /* SRC_MODULES_LIGHT_LIGHT_MANAGER_HPP */
