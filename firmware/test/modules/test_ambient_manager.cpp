#include "ambient_manager.hpp"
#include "types/ambient_data.hpp"
#include <gtest/gtest.h>

extern "C"
{

    bool alspt19_read_lux( const AlsPt19Device * device, float * lux )
    {
        if( device == nullptr )
        {
            return false;
        }
        *lux = *reinterpret_cast<const float *>( device );
        return true;
    }

    bool ema_init( EMAFilter * filter, float alpha )
    {
        filter->value = 0.0f;
        filter->alpha = alpha;
        filter->isInitialized = false;
        return true;
    }

    bool ema_update( EMAFilter * filter, float input, float * out )
    {
        if( !filter->isInitialized )
        {
            filter->value = input;
            filter->isInitialized = true;
        }
        else
        {
            filter->value = filter->value + filter->alpha * ( input - filter->value );
        }
        *out = filter->value;
        return true;
    }

} /* extern "C" */

TEST( AmbientManagerTest, BothSensorsOk_SystemOk )
{
    float primaryMock = 100.0f;
    float secondaryMock = 105.0f;

    ambient::Manager mgr( reinterpret_cast<AlsPt19Device *>( &primaryMock ),
                          reinterpret_cast<AlsPt19Device *>( &secondaryMock ), 
                          0.5f );

    ambient::Data data{};
    const bool ok = mgr.update( data );

    EXPECT_TRUE( ok );
    EXPECT_EQ( data.health, SensorHealth::SYSTEM_OK );
    EXPECT_FLOAT_EQ( data.lux, ( primaryMock + secondaryMock ) * 0.5f );
}

TEST( AmbientManagerTest, OnlyPrimaryOk )
{
    float primaryMock = 50.0f;

    ambient::Manager mgr( reinterpret_cast<AlsPt19Device *>( &primaryMock ), 
                          nullptr, 
                          0.5f );

    ambient::Data data{};
    const bool ok = mgr.update( data );

    EXPECT_FALSE( ok ); /* secondary nullptr, manager returns false */
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE ); /* fallback health */
}

TEST( AmbientManagerTest, BothSensorsFail )
{
    ambient::Manager mgr( nullptr, nullptr, 0.5f );

    ambient::Data data{};
    const bool ok = mgr.update( data );

    EXPECT_FALSE( ok );
    EXPECT_EQ( data.health, SensorHealth::TOTAL_FAILURE );
}
