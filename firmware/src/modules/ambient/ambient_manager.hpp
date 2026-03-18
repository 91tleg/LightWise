#ifndef SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP
#define SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP

#include <functional>  /* std::reference_wrapper */

#include "types/ambient_data.hpp"
#include "utils/math/ema.hpp"

namespace ambient
{

    class AmbientSensor;
    /**
     * @brief  Reads two ambient sensors, applies per-sensor EMA filtering,
     *         and reports fused lux and sensor health.
     *
     * All four dependencies are injected at construction time. 
     * Lifetimes of all injected objects must exceed that of Manager.
     */
    class Manager
    {
    public:
        /**
         * @param  primary         Primary ambient sensor (non-null).
         * @param  secondary       Secondary ambient sensor (non-null).
         * @param  primaryFilter   EMA filter for primary channel.
         * @param  secondaryFilter EMA filter for secondary channel.
         */
        explicit Manager( AmbientSensor & primary,
                          AmbientSensor & secondary,
                          filter::EMA< float > & primaryFilter,
                          filter::EMA< float > & secondaryFilter ) noexcept;

        ~Manager()                            = default;
        Manager( const Manager & )            = delete;
        Manager &operator=( const Manager & ) = delete;
        Manager( Manager && )                 = delete;
        Manager &operator=( Manager && )      = delete;

        /**
         * @brief  Read both sensors, update EMA filters, fuse results.
         *
         * The output structure is always written.
         *
         * @param  data  Filled with fused lux and health status.
         * @return true  if at least one sensor read succeeded.
         * @return false if both sensors failed (data.lux = last known average).
         */
        [[nodiscard]] bool update( Data & data ) noexcept;

    private:
        std::reference_wrapper< AmbientSensor        > primary_;
        std::reference_wrapper< AmbientSensor        > secondary_;
        std::reference_wrapper< filter::EMA< float > > primaryFilter_;
        std::reference_wrapper< filter::EMA< float > > secondaryFilter_;

        static constexpr float kDegradedThreshold { 10.0f };
    };

} /* namespace ambient */

#endif /* SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP */
