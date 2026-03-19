#ifndef SRC_SYS_MANAGER_INIT_HPP
#define SRC_SYS_MANAGER_INIT_HPP

#include "modules/ambient/ambient_manager.hpp"
#include "modules/th/th_manager.hpp"
#include "modules/mmwave/mmwave_manager.hpp"
#include "modules/light/light_manager.hpp"
#include "modules/lorawan/lorawan_manager.hpp"
#include "modules/fsm/fsm_manager.hpp"

namespace mgr
{

    void init();

    [[nodiscard]] ambient::Manager & getAmbientManager() noexcept;
    [[nodiscard]] th::Manager      & getThManager()      noexcept;
    [[nodiscard]] mmwave::Manager  & getMmwaveManager()  noexcept;
    [[nodiscard]] light::Manager   & getLightManager()   noexcept;
    [[nodiscard]] lorawan::Manager & getLorawanManager() noexcept;
    [[nodiscard]] fsm::Manager     & getFsmManager()     noexcept;

} /* namespace mgr */

#endif /* SRC_SYS_MANAGER_INIT_HPP */
