#include "rbd.h"

#include <stdatomic.h>

#include <driver/gptimer.h>
#include <esp_attr.h>
#include <esp_err.h>

static const uint32_t kPulseUs = 100UL;     /* TRIAC gate pulse width   */
static const uint32_t kTimerHz = 1000000UL; /* 1 MHz -> 1 µs resolution */

/* Shared between task context (rbd_hal_set_delay) and two ISRs
 * (on_zero_cross, on_timer_alarm). _Atomic guarantees the 32-bit
 * read/write is indivisible — an ISR cannot observe a half-written
 * value mid-update. */
static _Atomic uint32_t sDelayUs     = 0UL;
static gptimer_handle_t sTimer       = NULL;
static gpio_num_t       sTriacPin    = GPIO_NUM_NC;
static uint32_t         sHalfCycleUs = 0UL;

static bool IRAM_ATTR on_timer_alarm( gptimer_handle_t timer,
                                      const gptimer_alarm_event_data_t * edata,
                                      void * userCtx )
{
    ( void ) edata;
    ( void ) userCtx;

    const uint32_t delay = atomic_load_explicit( &sDelayUs,
                                                 memory_order_relaxed );

    if( delay == 0UL )
    {
        /* Pulse-end alarm — gate LOW. */
        gpio_set_level( sTriacPin, 0UL );
    }
    else
    {
        /* Firing-delay alarm — gate HIGH, rearm for pulse end. */
        gpio_set_level( sTriacPin, 1 );

        const gptimer_alarm_config_t pulseEnd =
        {
            .alarm_count  = kPulseUs,
            .reload_count = 0ULL,
            .flags.auto_reload_on_alarm = false
        };

        gptimer_set_alarm_action( timer, &pulseEnd );
        gptimer_start( timer );
    }

    return false; /* no higher-priority task woken */
}

static void IRAM_ATTR on_zero_cross( void * arg )
{
    ( void ) arg;

    const uint32_t delay = atomic_load_explicit( &sDelayUs,
                                                 memory_order_relaxed );

    if( delay == 0UL )
    {
        /* Level 100 — fire immediately, arm for pulse end only. */
        gpio_set_level( sTriacPin, 1UL );

        const gptimer_alarm_config_t pulseEnd =
        {
            .alarm_count  = kPulseUs,
            .reload_count = 0ULL,
            .flags.auto_reload_on_alarm = false
        };

        gptimer_set_alarm_action( sTimer, &pulseEnd );
    }
    else
    {
        /* Arm for firing delay. */
        const gptimer_alarm_config_t fire =
        {
            .alarm_count  = delay,
            .reload_count = 0ULL,
            .flags.auto_reload_on_alarm = false
        };

        gptimer_set_alarm_action( sTimer, &fire );
    }

    gptimer_start( sTimer );
}

bool rbd_hal_init( const RbdHw * const hw )
{
    bool ok = true;

    const uint32_t freqHz = ( hw->freqHz == 0UL ) ? 60UL : hw->freqHz;
    sHalfCycleUs = 1000000UL / ( freqHz * 2UL );

    atomic_store_explicit( &sDelayUs, sHalfCycleUs, memory_order_relaxed );

    const gpio_config_t triacCfg =
    {
        .pin_bit_mask = ( 1ULL << hw->triacPin ),
        .mode         = GPIO_MODE_OUTPUT,
        .pull_up_en   = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type    = GPIO_INTR_DISABLE
    };

    ok = ( gpio_config( &triacCfg ) == ESP_OK );

    if( ok )
    {
        gpio_set_level( hw->triacPin, 0 );

        const gpio_config_t zcCfg =
        {
            .pin_bit_mask = ( 1ULL << hw->zcPin ),
            .mode         = GPIO_MODE_INPUT,
            .pull_up_en   = GPIO_PULLUP_ENABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type    = GPIO_INTR_POSEDGE
        };

        ok = ( gpio_config( &zcCfg ) == ESP_OK );
    }

    if( ok )
    {
        /* May already be called by another driver. */
        ( void ) gpio_install_isr_service( 0 );

        ok = ( gpio_isr_handler_add( hw->zcPin,
                                     on_zero_cross, NULL ) == ESP_OK );
    }

    if( ok )
    {
        const gptimer_config_t timerCfg =
        {
            .clk_src          = GPTIMER_CLK_SRC_DEFAULT,
            .direction        = GPTIMER_COUNT_UP,
            .resolution_hz    = kTimerHz,
            .intr_priority    = 0,
            .flags.intr_shared = false
        };

        ok = ( gptimer_new_timer( &timerCfg, &sTimer ) == ESP_OK );
    }

    if( ok )
    {
        const gptimer_event_callbacks_t cbs = 
        {
            .on_alarm = on_timer_alarm
        };

        ok = ( gptimer_register_event_callbacks( sTimer, &cbs, NULL ) == ESP_OK );
    }

    if( ok )
    {
        ok = ( gptimer_enable( sTimer ) == ESP_OK );
    }

    return ok;
}

void rbd_hal_set_delay( uint32_t delayUs )
{
    atomic_store_explicit( &sDelayUs, delayUs, memory_order_release );
}

void rbd_hal_get_delay( uint32_t * delayUs )
{
    if( delayUs != NULL )
    {
        *delayUs = atomic_load_explicit( &sDelayUs, memory_order_relaxed );
    }
}

void rbd_hal_output_off( void )
{
    gpio_set_level( sTriacPin, 0UL );
}

uint32_t rbd_hal_half_cycle_us( void )
{
    return sHalfCycleUs;
}
