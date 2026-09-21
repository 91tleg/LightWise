#ifndef SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP
#define SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP

#include <cstdint>
#include "utils/math/fault_counter.hpp"

namespace filter
{
class Kalman1D;
}

enum class SensorHealth : uint8_t;

namespace ambient
{

struct Data;
class AmbientSensor;

/**
 * @brief  Reads two redundant ambient sensors, fuses them with a shared
 *         Kalman filter, and isolates the faulty sensor using innovation
 *         gating against the filter's prediction.
 *
 * All dependencies are injected. Their lifetimes must exceed the Manager's.
 */
class Manager
{
public:
    /**
     * @param  primary    Primary ambient sensor.
     * @param  secondary  Secondary ambient sensor.
     * @param  filter     Shared scalar Kalman filter (owned by caller).
     */
    explicit Manager( AmbientSensor & primary,
                      AmbientSensor & secondary,
                      filter::Kalman1D & filter ) noexcept;

    ~Manager()                             = default;
    Manager( const Manager & )             = delete;
    Manager & operator=( const Manager & ) = delete;
    Manager( Manager && )                  = delete;
    Manager & operator=( Manager && )      = delete;

    /**
     * @brief  Read both sensors, update the filter, classify health.
     *
     * data.health is always written. data.lux is only written when the
     * result is true; otherwise the last known value is preserved.
     *
     * @return true  if the fused estimate is usable.
     * @return false on total failure.
     */
    [[nodiscard]] bool update( Data & data ) noexcept;

private:
    /* Filter, gating, and fault bookkeeping for one cycle where at least
       one sensor produced a reading. */
    SensorHealth process( float zP, bool pRead, float zS, bool sRead ) noexcept;

    AmbientSensor & primary_;
    AmbientSensor & secondary_;
    filter::Kalman1D & kf_;

    filter::FaultCounter primaryFaults_;
    filter::FaultCounter secondaryFaults_;
    uint8_t              rejectStreak_ { 0U };
    uint8_t              ambiguousStreak_ { 0U };
};

} /* namespace ambient */

#endif /* SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP */
