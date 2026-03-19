#ifndef SRC_COMMON_UTILS_NUM_FMT_H
#define SRC_COMMON_UTILS_NUM_FMT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif


/**
 * @brief Hex-encode binary data into uppercase ASCII.
 *
 * @param in       Input byte buffer
 * @param inLen    Number of bytes to encode
 * @param out      Output buffer
 * @param outCap   Output buffer capacity (must be >= inLen*2 + 1)
 *
 * @return true on success, false on error
 */
bool num_fmt_hex_encode( const uint8_t * in,
                         size_t inLen,
                         char * out,
                         size_t outCap );

/**
 * @brief Convert uint32_t to decimal ASCII.
 *
 * @param value    Value to convert
 * @param out      Output buffer
 * @param outCap   Output buffer capacity
 *
 * @return true on success, false on error
 */
bool num_fmt_u32toa( uint32_t value,
                         char * out,
                         size_t outCap );

/**
 * @brief Convert uint8_t to decimal ASCII.
 *
 * @param value    Value to convert
 * @param out      Output buffer
 * @param outCap   Output buffer capacity
 *
 * @return true on success, false on error
 */
bool num_fmt_u8toa( uint8_t value,
                    char * out,
                    size_t outCap );

/**
 * @brief Convert uint32_t to fixed-width 8-char uppercase hex.
 *
 * @param value    Value to convert
 * @param out      Output buffer (needs >= 9 bytes)
 * @param outCap   Output buffer capacity
 *
 * @return true on success, false on error
 */
bool num_fmt_u32_to_hex8( uint32_t value,
                          char * out,
                          size_t outCap );

/**
 * @brief Append an unsigned integer to a buffer as ASCII characters.
 *
 * @param p      Pointer to the buffer position to start writing.
 * @param value  Unsigned integer to write.
 * @return       Pointer to the next free position in the buffer.
 */
char * num_fmt_append_u16(char * p, uint16_t value);


/**
 * @brief Append a fixed-point value with one decimal digit.
 *
 * The input value is in tenths (e.g. 24 → "2.4").
 *
 * @param p      Destination buffer pointer.
 * @param tenths Value in tenths.
 * @return       Pointer to the next free position.
 */
char * num_fmt_append_fixed1( char * p, uint16_t tenths );

#ifdef __cplusplus
}
#endif 

#endif /* SRC_COMMON_UTILS_NUM_FMT_H */
