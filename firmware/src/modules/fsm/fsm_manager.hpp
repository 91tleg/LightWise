#ifndef SRC_MODULES_FSM_FSM_MANAGER_HPP
#define SRC_MODULES_FSM_FSM_MANAGER_HPP

#include <cstdint>

#include "types/ambient_data.hpp"
#include "types/mmwave_data.hpp"
#include "types/th_data.hpp"
#include "types/lorawan_data.hpp"

namespace fsm
{
    /**
     * @brief Finite State Machine Manager for streetlight control logic.
     * 
     * This class manages the decision-making process for streetlight behavior
     * based on sensor inputs from ambient, mmWave motion, and temperature/humidity sensors.
     * It determines light levels and prepares uplink data for LoRaWAN transmission.
     */
    class Manager
    {
    public:
        /**
         * @brief Input data structure containing sensor readings.
         */
        struct Inputs
        {
            ambient::Data ambient; /**< Ambient light and health data */
            mmwave::Data mmwave;   /**< mmWave motion detection and health data */
            th::Data th;           /**< Temperature and humidity data */
        };

        /**
         * @brief Output data structure containing control decisions and uplink data.
         */
        struct Outputs
        {
            uint8_t lightLevel;              ///< Desired light level (0-100%)
            lorawan::UplinkData uplinkData;  ///< Data to be sent via LoRaWAN
        };

        /**
         * @brief Constructor for the FSM Manager.
         * 
         * Initializes the manager with default state values.
         */
        explicit Manager();

        /**
         * @brief Updates the FSM state and computes outputs based on current inputs.
         * 
         * @param inputs Current sensor inputs
         * @return Outputs containing light level and uplink data
         */
        Outputs update( const Inputs & inputs );

    private:
        bool lastPrimaryMotion_ = false;   /**< Last state of primary motion detection */
        bool lastSecondaryMotion_ = false; /**< Last state of secondary motion detection */

        /**
         * @brief Computes status flags for uplink data based on sensor health.
         * 
         * @param inputs Current sensor inputs
         * @return Bitfield of status flags
         */
        uint8_t computeFlags( const Inputs & inputs );
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_MANAGER_HPP */
