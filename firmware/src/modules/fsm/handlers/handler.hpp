#ifndef SRC_MODULES_FSM_HANDLERS_HANDLER_HPP
#define SRC_MODULES_FSM_HANDLERS_HANDLER_HPP

#include "fsm_types.hpp"
#include "common/types/fsm_event.hpp"

namespace fsm
{

    class Handler
    {
    public:
        virtual ~Handler() = default;

        /**
         * @brief  Process one event in this state.
         *
         * @param  event   The event that triggered this call.
         * @param  data    Sensor data associated with the event.
         * @param  config  Mutable runtime configuration (levels).
         * @return HandlerResult containing the next state and uplink flag.
         */
        [[nodiscard]] virtual HandlerResult process( Event event,
                                                     const EventData & data,
                                                     Config & config ) noexcept = 0;

    protected:
        Handler()                              = default;
        Handler( const Handler & )             = default;
        Handler & operator=( const Handler & ) = default;
        Handler( Handler && )                  = default;
        Handler & operator=( Handler && )      = default;
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_HANDLERS_HANDLER_HPP */
