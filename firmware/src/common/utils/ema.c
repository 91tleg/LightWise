#include "ema.h"

#include <stddef.h>  /* for NULL */

#define EMA_ALPHA_MIN     ( 0.0f )
#define EMA_ALPHA_MAX     ( 1.0f )
#define EMA_ALPHA_DEFAULT ( 0.1f )

static float ema_clamp_alpha( float alpha );

bool ema_init( EMAFilter * const filter,
               float alpha )
{
    bool result = false;

    if( filter != NULL )
    {
        float useAlpha = 0.0f;

        if( alpha == 0.0f )
        {
            useAlpha = EMA_ALPHA_DEFAULT;
        }
        else
        {
            useAlpha = ema_clamp_alpha( alpha );
        }

        /* Initialize filter state */
        filter->value = 0.0f;
        filter->alpha = useAlpha;
        filter->isInitialized = false;

        result = true;
    }
    return result;
}

bool ema_update( EMAFilter * const filter,
                 float input,
                 float * const out )
{
    bool result = false;

    if( ( filter != NULL ) && ( out != NULL ) )
    {
        if( filter->isInitialized )
        {
            /* Standard EMA formula */
            filter->value = filter->value + ( filter->alpha * ( input - filter->value ) );
        }
        else
        {
            /* First sample sets initial value */
            filter->value = input;
            filter->isInitialized = true;
        }

        *out = filter->value;
        result = true;
    }

    return result;
}

bool ema_reset( EMAFilter * const filter )
{
    bool result = false;

    if( filter != NULL )
    {
        filter->isInitialized = false;
        result = true;
    }

    return result;
}

/* Private: clamp alpha to [EMA_ALPHA_MIN, EMA_ALPHA_MAX] */
static float ema_clamp_alpha( float alpha )
{
    float clampedAlpha = 0.0f;

    if( alpha < EMA_ALPHA_MIN )
    {
        clampedAlpha = EMA_ALPHA_MIN;
    }
    else if( alpha > EMA_ALPHA_MAX )
    {
        clampedAlpha = EMA_ALPHA_MAX;
    }
    else
    {
        clampedAlpha = alpha;
    }

    return clampedAlpha;
}
