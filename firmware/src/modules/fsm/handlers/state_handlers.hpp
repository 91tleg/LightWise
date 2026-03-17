#ifndef SRC_MODULES_FSM_HANDLERS_STATE_HANDLERS_HPP
#define SRC_MODULES_FSM_HANDLERS_STATE_HANDLERS_HPP

#include "handler.hpp"

namespace fsm
{

    class AutoOffHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class AutoDimHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class MotionActiveHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class ManualOnHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class ManualOffHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class TempDimHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

    class FaultHandler final : public Handler
    {
    public:
        [[nodiscard]] HandlerResult process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept override;
    };

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_HANDLERS_STATE_HANDLERS_HPP */
