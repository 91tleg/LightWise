#ifndef SRC_SYS_MANAGER_INIT_HPP
#define SRC_SYS_MANAGER_INIT_HPP

namespace ambient
{
    class Manager;
}

namespace th
{
    class Manager;
}

namespace mmwave
{
    class Manager;
}

namespace light
{
    class Manager;
}

namespace lorawan
{
    class Manager;
}

namespace fsm
{
    class Manager; 
}

namespace config
{
    struct SystemConfig;
    class ConfigStore;
}

namespace mgr
{

    void init();

    [[nodiscard]] ambient::Manager     & getAmbientManager() noexcept;
    [[nodiscard]] th::Manager          & getThManager()      noexcept;
    [[nodiscard]] mmwave::Manager      & getMmwaveManager()  noexcept;
    [[nodiscard]] light::Manager       & getLightManager()   noexcept;
    [[nodiscard]] lorawan::Manager     & getLorawanManager() noexcept;
    [[nodiscard]] fsm::Manager         & getFsmManager()     noexcept;
    [[nodiscard]] config::ConfigStore  & getConfigStore()    noexcept;
    [[nodiscard]] config::SystemConfig & getSystemConfig()   noexcept;

} /* namespace mgr */

#endif /* SRC_SYS_MANAGER_INIT_HPP */
