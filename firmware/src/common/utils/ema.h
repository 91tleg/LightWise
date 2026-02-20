/******************************************************************************
 * @file    ema.h
 * @brief   Exponential Moving Average (EMA) filter for smoothing sensor data
 *
 * Copyright (c) 2026 LightWise. All rights reserved.
 * See LICENSE file in the project root for license information.
 ******************************************************************************/

#ifndef SRC_COMMON_UTILS_EMA_H
#define SRC_COMMON_UTILS_EMA_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct EMAFilter
{
    float value;          /**< Current filtered value */
    float alpha;          /**< Smoothing factor (0.0 to 1.0). Higher values respond faster */
    bool  isInitialized;  /**< Filter initialization status flag */
} EMAFilter;

/**
 * @brief Initialize the EMA filter
 *
 * Sets up the filter with the specified smoothing factor.
 * The filter must be initialized before use.
 *
 * @param filter Pointer to EMA filter structure
 * @param alpha  Smoothing factor (0.0 to 1.0). Values closer to 0 provide
 *               more smoothing, values closer to 1 respond faster to changes.
 *               Values outside (0,1] are clamped.
 *
 * @return true  Initialization successful
 * @return false Initialization failed or invalid parameter
 */
bool ema_init( EMAFilter * filter, 
               float alpha );

/**
 * @brief Update the EMA filter with a new input value
 *
 * Computes the exponential moving average: output = alpha * input + (1 - alpha) * previous_value
 *
 * @param filter Pointer to initialized EMA filter structure
 * @param input  New input value to process
 * @param out    Pointer to output buffer for filtered value
 *
 * @return true  Update successful and output written
 * @return false Update failed or invalid parameter
 */
bool ema_update( EMAFilter * filter,
                 float input,
                 float * out );

/**
 * @brief Reset the EMA filter to uninitialized state
 *
 * Clears the filter state. Must reinitialize before using again.
 *
 * @param filter Pointer to EMA filter structure
 *
 * @return true  Reset successful
 * @return false Reset failed or invalid parameter
 */
bool ema_reset( EMAFilter * filter );

#ifdef __cplusplus
}
#endif

#endif /* SRC_COMMON_UTILS_EMA_H */
