#ifndef SRC_MODULES_LORAWAN_RADIO_TASK_HPP
#define SRC_MODULES_LORAWAN_RADIO_TASK_HPP

namespace lorawan
{
    class Manager;

    struct RadioTaskParams
    {
        Manager & mgr;
    };

    void radioTask( void * pvParameters );

}

#endif /* SRC_MODULES_LORAWAN_RADIO_TASK_HPP */
