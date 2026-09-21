#include "ambient_manager.hpp"

#include "lib/ambient/ambient_sensor.hpp"
#include "types/ambient_data.hpp"
#include "utils/math/kalman1d.hpp"
#include "common/types/sensor_health.hpp"
#include "utils/log/log.h"

namespace ambient
{

namespace
{

constexpr float   kGate        { 9.0f };    /* ~3 sigma on NIS */
constexpr float   kStepInflate { 1.0e4f };  /* lux^2, tune */
constexpr float   kRelNoise    { 0.05f };   /* 5% of reading */
constexpr float   kAbsNoise    { 1.0f };    /* lux floor */
constexpr uint8_t kFaultLimit  { 5U };
constexpr uint8_t kFaultMax    { 10U };
constexpr uint8_t kReseedLimit { 10U };
constexpr uint8_t kAmbiguousLimit { 5U };   /* cycles before forcing a verdict */
constexpr float   kArbitrateMargin { 0.25f }; /* of |zP - zS|, nearer must win by this */

float measVar( float z ) noexcept
{
    const float sigma { kRelNoise * ( ( z >= 0.0f ) ? z : -z ) + kAbsNoise };
    return sigma * sigma;
}

void seed( filter::Kalman1D & kf,
           float zP, bool pRead, float rP,
           float zS, bool sRead, float rS ) noexcept
{
    if( pRead && sRead ) { kf.reset( 0.5f * ( zP + zS ), 0.5f * ( rP + rS ) ); }
    else if( pRead )     { kf.reset( zP, rP ); }
    else                 { kf.reset( zS, rS ); }
}

} /* anonymous namespace */

Manager::Manager( AmbientSensor & primary,
                  AmbientSensor & secondary,
                  filter::Kalman1D & filter ) noexcept
    : primary_ { primary }
    , secondary_ { secondary }
    , kf_ { filter }
    , primaryFaults_ { kFaultLimit, kFaultMax }
    , secondaryFaults_ { kFaultLimit, kFaultMax }
{
}

SensorHealth Manager::process( float zP, bool pRead, float zS, bool sRead ) noexcept
{
    const float rP { pRead ? measVar( zP ) : 0.0f };
    const float rS { sRead ? measVar( zS ) : 0.0f };

    if( !kf_.initialized() )
    {
        seed( kf_, zP, pRead, rP, zS, sRead, rS );
    }

    kf_.predict();

    /* Which measurements agree with the model's prediction? */
    bool pGood { pRead && ( kf_.nis( zP, rP ) <= kGate ) };
    bool sGood { sRead && ( kf_.nis( zS, rS ) <= kGate ) };
    bool ambiguous { false };
    const bool crossChecked { pRead && sRead };

    if( pRead && sRead )
    {
        const float d { zP - zS };
        const bool agree { ( d * d ) <= kGate * ( rP + rS ) };

        if( agree )
        {
            /* Sensors agree with each other; if the model disagrees with
               both, it's a real step change: trust the sensors. */
            if( !pGood && !sGood ) { kf_.inflate( kStepInflate ); }
            pGood = true;
            sGood = true;
        }
        else if( pGood == sGood )
        {
            ambiguous = true;
        }
        else
        {
            /* exactly one matches the prediction: the other is the culprit */
        }
    }

    if( ambiguous )
    {
        ++ambiguousStreak_;

        if( ambiguousStreak_ >= kAmbiguousLimit )
        {
            /* Sustained disagreement: the model can't arbitrate by gating,
               so blame whichever sensor sits farther from the estimate. */
            const float dP { ( zP > kf_.x() ) ? ( zP - kf_.x() ) : ( kf_.x() - zP ) };
            const float dS { ( zS > kf_.x() ) ? ( zS - kf_.x() ) : ( kf_.x() - zS ) };
            const float gap { ( zP > zS ) ? ( zP - zS ) : ( zS - zP ) };
            const float margin { kArbitrateMargin * gap };

            if( ( dS - dP ) > margin )      { pGood = true;  sGood = false; ambiguous = false; }
            else if( ( dP - dS ) > margin ) { pGood = false; sGood = true;  ambiguous = false; }
            /* else: equidistant, stay ambiguous */
        }
    }
    else
    {
        ambiguousStreak_ = 0U;
    }

    if( ambiguous )
    {
        /* No reliable evidence for either sensor: fuse the midpoint and
           widen its variance by the disagreement so P doesn't collapse
           onto a blend of a possibly bad sensor. */
        const float d { zP - zS };
        kf_.update( 0.5f * ( zP + zS ),
                    0.25f * ( rP + rS ) + 0.25f * d * d );
    }
    else
    {
        if( pGood ) { kf_.update( zP, rP ); }
        if( sGood ) { kf_.update( zS, rS ); }

        /* Recover from a sustained real change that only one sensor saw */
        if( pGood || sGood )
        {
            rejectStreak_ = 0U;
        }
        else
        {
            ++rejectStreak_;
            if( rejectStreak_ >= kReseedLimit )
            {
                seed( kf_, zP, pRead, rP, zS, sRead, rS );
                rejectStreak_ = 0U;
            }
        }
    }

    /* Ambiguous cycles blame nobody; read failures and cross-checked
       outliers do. With only one sensor reading, a gate rejection has no
       corroboration (it may be a real step), so it isn't held against
       the sensor: the reseed path handles it instead. */
    if( !ambiguous )
    {
        primaryFaults_.record( !pRead || ( crossChecked && !pGood ) );
        secondaryFaults_.record( !sRead || ( crossChecked && !sGood ) );
    }

    const bool pBad { primaryFaults_.tripped() };
    const bool sBad { secondaryFaults_.tripped() };

    SensorHealth health { SensorHealth::SYSTEM_OK };

    if( pBad && sBad )   { health = SensorHealth::TOTAL_FAILURE; }
    else if( pBad )      { health = SensorHealth::PRIMARY_FAIL; }
    else if( sBad )      { health = SensorHealth::SECONDARY_FAIL; }
    else if( ambiguous ) { health = SensorHealth::DEGRADED; }
    else                 { health = SensorHealth::SYSTEM_OK; }

    return health;
}

bool Manager::update( Data & data ) noexcept
{
    float zP { 0.0f };
    float zS { 0.0f };
    const bool pRead { primary_.read( zP ) };
    const bool sRead { secondary_.read( zS ) };

    SensorHealth health { SensorHealth::TOTAL_FAILURE };

    if( pRead || sRead )
    {
        health = process( zP, pRead, zS, sRead );
    }
    else
    {
        primaryFaults_.record( true );
        secondaryFaults_.record( true );
    }

    const bool result { health != SensorHealth::TOTAL_FAILURE };

    if( result )
    {
        data.lux = kf_.x();
    }
    data.health = health;

    LOGI( "ambient_manager", "x: %f, P: %f, zP: %f, zS: %f, fP: %u, fS: %u",
          kf_.x(), kf_.p(), zP, zS,
          static_cast< unsigned >( primaryFaults_.count() ),
          static_cast< unsigned >( secondaryFaults_.count() ) );

    return result;
}

} /* namespace ambient */
