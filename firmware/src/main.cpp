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

#include <nvs_flash.h>

#include "hal_init.hpp"
#include "device_init.hpp"
#include "task_init.hpp"

extern "C" void app_main( void )
{
    esp_err_t err = nvs_flash_init();
    if( ( err == ESP_ERR_NVS_NO_FREE_PAGES ) ||
        ( err == ESP_ERR_NVS_NEW_VERSION_FOUND ) )
    {
        ESP_ERROR_CHECK( nvs_flash_erase() );
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK( err );

    hal::init();
    device::init();
    task::init();
}
