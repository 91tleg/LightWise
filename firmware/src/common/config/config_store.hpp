#ifndef SRC_COMMON_CONFIG_CONFIG_STORE_HPP
#define SRC_COMMON_CONFIG_CONFIG_STORE_HPP

#include <cstdint>

namespace config
{

    struct SystemConfig
    {
        uint8_t  maxLevel          { 100U };  /**< Maximum light level (0-100%)     */
        uint8_t  dimLevel          { 30U  };  /**< Auto-dim level (0-100%)          */
        uint16_t motionTimeoutS    { 30U  };  /**< Motion timeout in seconds        */
        uint8_t  motionSensitivity { 5U   };  /**< mmWave sensitivity (0-10)        */
        uint8_t  heartbeatMin      { 60U  };  /**< Telemetry heartbeat in minutes   */
    };

    /**
     * @brief  Abstract interface for system configuration persistence.
     *
     * load()  — called once at boot; populates SystemConfig from storage.
     *           Returns false if storage is uninitialised; caller uses defaults.
     *
     * save()  — called by the downlink decoder when a persistent command is
     *           received.  Saves the entire struct atomically.
     *           Reads do not happen at runtime — only writes.
     */
    class ConfigStore
    {
    public:
        virtual ~ConfigStore() = default;

        /**
         * @brief  Load configuration from persistent storage.
         *
         * @param  config  Populated with stored values on success.
         *                 Untouched on failure — caller's defaults apply.
         * @return true  if all values were loaded successfully.
         * @return false if storage is uninitialised or corrupt (use defaults).
         */
        [[nodiscard]] virtual bool load( SystemConfig & config ) noexcept = 0;

        /**
         * @brief  Save the entire configuration to persistent storage.
         *
         * Called after a validated persistent downlink command.
         * Saves the whole struct — atomicity is simpler than per-field saves
         * and NVS wear is negligible at streetlight command frequency.
         *
         * @param  config  Configuration to persist.
         * @return true  if saved successfully.
         * @return false if the write failed.
         */
        [[nodiscard]] virtual bool save( const SystemConfig & config ) noexcept = 0;

    protected:
        ConfigStore()                                  = default;
        ConfigStore( const ConfigStore & )             = default;
        ConfigStore & operator=( const ConfigStore & ) = default;
        ConfigStore( ConfigStore && )                  = default;
        ConfigStore & operator=( ConfigStore && )      = default;
    };

} /* namespace config */

#endif /* SRC_COMMON_CONFIG_CONFIG_STORE_HPP */
