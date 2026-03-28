#include "nvs_config_store.hpp"

#include <nvs.h>
#include <nvs_flash.h>

#include "utils/nvs/nvs_utils.hpp"
#include "utils/log/log.h"

namespace config
{

    namespace
    {

        constexpr char kTag[] { "NvsConfigStore" };

    } /* anonymous namespace */

    bool NvsConfigStore::load( SystemConfig & config ) noexcept
    {
        bool allFound { false };
        nvs::Handle handle { kNamespace, NVS_READONLY };

        if( !handle.ok() )
        {
            LOGW( kTag, "NVS namespace not found — using defaults" );
        }
        else
        {
            allFound = handle.readU8 ( kKeyMaxLevel,      config.maxLevel          ) &&
                       handle.readU8 ( kKeyDimLevel,      config.dimLevel          ) &&
                       handle.readU16( kKeyMotionTimeout, config.motionTimeoutS    ) &&
                       handle.readU8 ( kKeyMotionSens,    config.motionSensitivity ) &&
                       handle.readU8 ( kKeyHeartbeat,     config.heartbeatMin      );

            if( allFound )
            {
                LOGI( kTag, "Config loaded from NVS" );
            }
            else
            {
                LOGW( kTag, "Some config keys missing" );
            }
        }

        return allFound;
    }

    bool NvsConfigStore::save( const SystemConfig & config ) noexcept
    {
        bool ok { false };
        nvs::Handle handle { kNamespace, NVS_READWRITE };
        if( handle.ok() )
        {

            ok = handle.writeU8 ( kKeyMaxLevel,      config.maxLevel          ) &&
                 handle.writeU8 ( kKeyDimLevel,      config.dimLevel          ) &&
                 handle.writeU16( kKeyMotionTimeout, config.motionTimeoutS    ) &&
                 handle.writeU8 ( kKeyMotionSens,    config.motionSensitivity ) &&
                 handle.writeU8 ( kKeyHeartbeat,     config.heartbeatMin      ) &&
                 handle.commit();

            if( ok )
            {
                LOGI( kTag, "Saved to NVS" );
            }
            else
            {
                LOGE( kTag, "NVS save failed" );
            }
        }
        return ok;
    }

} /* namespace config */
