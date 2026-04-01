#ifndef SRC_HAL_RBD_H
#define SRC_HAL_RBD_H

#include <stdbool.h>
#include <stdint.h>

#include <driver/gpio.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct RbdHw
{
    gpio_num_t triacPin;  /**< GPIO output — TRIAC gate pulse     */
    gpio_num_t zcPin;     /**< GPIO input  — zero-cross detection */
    uint32_t   freqHz;    /**< Mains frequency — 50 or 60         */
} RbdHw;

/**
 * @brief  Initialise GPIO and gptimer hardware.
 *
 * Configures the TRIAC output pin, zero-cross input pin with rising-edge
 * ISR, and a 1 MHz one-shot gptimer.  Must be called once before any
 * other hal_light_* function.
 *
 * @param  hw  Non-null pointer to populated RbdHw struct.
 * 
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool rbd_hal_init( const RbdHw * hw );

/**
 * @brief  Set the TRIAC firing delay for the next half-cycle.
 *
 * Called from task context. The delay is applied atomically — the next
 * zero-cross ISR reads the updated value.
 *
 * @param  delayUs  Firing delay in microseconds.
 *                  0 = fire immediately (level 100).
 *                  half_cycle_us = never fire (level 0).
 */
void rbd_hal_set_delay( uint32_t delayUs );

/**
 * @brief  Read the currently active firing delay.
 *
 * @param  delayUs  Filled with the current delay value.
 */
void rbd_hal_get_delay( uint32_t * delayUs );

/**
 * @brief  Force the TRIAC output low immediately.
 *
 * Used when level is set to 0 — ensures output is low without waiting
 * for the next zero-cross.
 */
void rbd_hal_output_off( void );

/**
 * @brief  Return the half-cycle duration in microseconds.
 *
 * @return Half-cycle duration in microseconds (10000 at 50 Hz,
 *         8333 at 60 Hz).
 */
uint32_t rbd_hal_half_cycle_us( void );

#ifdef __cplusplus
}
#endif

#endif /* SRC_HAL_RBD_H */
