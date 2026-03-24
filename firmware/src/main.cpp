/******************************************************************************
 * @file    main.cpp
 * @brief   Main entry point
 *
 * @author  Max Chou
 * @date    2026-02-23
 * 
 * @copyright
 * Copyright (c) 2026 LightWise
 * All rights reserved.
 * 
 * .____    .__       .__     __   __      __.__               
 * |    |   |__| ____ |  |___/  |_/  \    /  \__| ______ ____  
 * |    |   |  |/ ___\|  |  \   __\   \/\/   /  |/  ___// __ \ 
 * |    |___|  / /_/  >   Y  \  |  \        /|  |\___ \\  ___/ 
 * |_______ \__\___  /|___|  /__|   \__/\  / |__/____  >\___  >
 *         \/ /_____/      \/            \/          \/     \/
 * 
 * This source code is publicly visible for reference purposes only.
 * No license is granted to use, copy, modify, merge, publish, distribute,
 * sublicense, or sell this software without explicit written permission
 * from LightWise.
 ******************************************************************************/

#include "sys/nvs_init.hpp"
#include "sys/hal_init.hpp"
#include "sys/manager_init.hpp"
#include "sys/task_init.hpp"

extern "C" void app_main( void )
{
    nvs::init();
    hal::init();
    mgr::init();
    task::init();
}
