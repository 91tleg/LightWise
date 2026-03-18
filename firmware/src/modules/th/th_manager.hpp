#ifndef SRC_MODULES_TH_TH_MANAGER_HPP
#define SRC_MODULES_TH_TH_MANAGER_HPP

#include <cstdint>
#include <functional>

#include "utils/math/ema.hpp"
#include "types/th_data.hpp"

namespace th
{

    class THSensor;

    /**
     * @brief Manages temperature and humidity sensor access and filtering.
     *
     * This class provides a high-level interface for any temperature and humidity
     * sensor implementing the THSensor interface. Raw sensor readings are filtered
     * using an exponential moving average (EMA) to reduce noise and provide
     * smooth output data.
     */
    class Manager
    {
    public:
        /**
         * @brief  Construct with all dependencies injected.
         *
         * @param  sensor       Temperature/humidity sensor (static lifetime).
         * @param  tempFilter   EMA filter for temperature channel.
         * @param  humFilter    EMA filter for humidity channel.
         */
        explicit Manager( THSensor & sensor,
                          filter::EMA< uint8_t > & tempFilter,
                          filter::EMA< uint8_t > & humFilter ) noexcept;

        ~Manager()                            = default;
        Manager( const Manager & )            = delete;
        Manager &operator=( const Manager & ) = delete;
        Manager( Manager && )                 = delete;
        Manager &operator=( Manager && )      = delete;

        /**
         * @brief  Read sensor, apply EMA filters, validate range, populate data.
         *
         * @param  data  Filled with filtered temperature, humidity, and health.
         * @return true  if read and filtering succeeded and values are in range.
         * @return false if the sensor read failed or values were out of range.
         */
        [[nodiscard]] bool update( Data &data ) noexcept;

    private:
        std::reference_wrapper< THSensor > sensor_;
        std::reference_wrapper< filter::EMA< uint8_t > > tempFilter_;
        std::reference_wrapper< filter::EMA< uint8_t > > humFilter_;

        static constexpr uint8_t kReadingMinValue { 0U    };
        static constexpr uint8_t kReadingMaxValue { 0XFFU };
    };

} /* namespace th */

#endif /* SRC_MODULES_TH_TH_MANAGER_HPP */
