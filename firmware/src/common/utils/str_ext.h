/**
 * @file str_ext.h
 * @brief Extended string utility functions for parsing and command building.
 *
 * All functions are designed to be safe with NULL checks and length checks.
 */

#ifndef SRC_COMMON_UTILS_STR_EXT_H
#define SRC_COMMON_UTILS_STR_EXT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Retrieves a specific field from a comma-separated buffer.
 *
 * Fields are indexed starting at 0.
 *
 * @param buf Pointer to the buffer containing comma-separated fields.
 * @param len Length of the buffer.
 * @param pos Starting position in the buffer to search.
 * @param fieldIndex Index of the field to extract.
 * @param outStart Pointer to store the starting index of the field in buf.
 * @param outLen Pointer to store the length of the field.
 * @return true if the field exists and indices are valid, false otherwise.
 */
bool str_ext_get_field( const uint8_t * buf,
                        size_t len,
                        size_t pos,
                        uint8_t fieldIdx,
                        size_t * outStart,
                        size_t * outLen );

/**
 * @brief Parses a string representing a fixed-point number with up to 2 decimal places
 *        and returns the value scaled by 100 (x100 format).
 *
 * Examples:
 *  - "12.34" -> 1234
 *  - "-1.5"  -> -150
 *
 * @param s Pointer to the string to parse.
 * @param len Length of the string.
 * @param outVal Pointer to store the parsed integer value in x100 format.
 * @return true if parsing succeeds, false otherwise (invalid characters or empty input).
 */
bool str_ext_parse_x100( const uint8_t * s, 
                         size_t len, 
                         int32_t * outVal );

/**
 * @brief Convert a null-terminated string to uppercase in-place.
 *
 * This function modifies the input string by converting all lowercase
 * ASCII letters ('a'-'z') to uppercase ('A'-'Z'). Non-alphabetic
 * characters are left unchanged.
 *
 * @param[in,out] str Pointer to the null-terminated string to convert.
 * @return true if succeeds, false otherwise (invalid input).
 */
bool str_ext_to_upper_case( char * str );

/**
 * @brief Check if a buffer starts with a specific prefix string.
 * @param[in] buf       The buffer to check.
 * @param[in] len       Length of the buffer.
 * @param[in] prefix    The string to look for.
 * @param[in] prefixLen Length of the prefix.
 * @return true  If the buffer starts with the prefix.
 *         False If no match or length mismatch.
 */
bool str_ext_starts_with( const uint8_t * buf, 
                          size_t len, 
                          const char * prefix, 
                          size_t prefixLen);

/**
 * @brief Get the length of a string, up to a maximum capacity.
 *
 * Similar to `strnlen()`, this function returns the number of characters
 * in the string before the null-terminator, but will not exceed `cap`.
 *
 * @param[in] str  Pointer to the null-terminated string to measure.
 * @param[in] cap  Maximum number of characters to examine.
 * @return The number of characters in the string, up to `cap`.
 *         Returns 0 if `str` is NULL.
 */
size_t str_ext_strnlen( const char * str, 
                        size_t cap );

/**
 * @brief Find the index of a character in a byte buffer.
 *
 * Searches the buffer for the first occurrence of the specified character.
 *
 * @param[in] buf  Pointer to the buffer to search.
 * @param[in] len  Number of bytes in the buffer.
 * @param[in] ch   Character to search for.
 * @return The index of the first occurrence of `ch` in `buf`, or -1 if
 *         the character is not found or `buf` is NULL.
 */
int str_ext_buf_find_char( const uint8_t * buf, 
                           size_t len,
                           uint8_t ch );

/**
 * Convert a byte array to an uppercase hex string.
 *
 * @param in        Input byte array
 * @param len       Number of bytes in input
 * @param out       Output buffer (char array)
 * @param out_size  Size of output buffer in bytes
 * @return true on success, false if output buffer too small
 *
 * Required out_size >= (len * 2 + 1)
 */
bool str_ext_uint8_array_to_hex_string( const uint8_t * in,
                                        size_t len,
                                        char * out,
                                        size_t outSize );

#ifdef __cplusplus
}
#endif

#endif /* SRC_COMMON_UTILS_STR_EXT_H */
