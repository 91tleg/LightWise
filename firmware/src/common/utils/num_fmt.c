#include "num_fmt.h"

static char num_fmt_hex_nibble_to_char( uint8_t value );

bool num_fmt_hex_encode( const uint8_t * const in,
                         size_t inLen,
                         char * const out,
                         size_t outCap )
{
    bool result = false;


    if( ( in != NULL ) && ( out != NULL ) )
    {    
        const size_t need = ( inLen * 2U ) + 1U;

        if( outCap >= need )
        {
            for( size_t i = 0U; i < inLen; ++i )
            {
                uint8_t b = in[ i ];
                out[ ( i * 2U ) ] = num_fmt_hex_nibble_to_char( ( uint8_t ) ( b >> 4 ) );
                out[ ( i * 2U ) + 1U ] = num_fmt_hex_nibble_to_char( b );
            }

            out[ inLen * 2U ] = '\0';
            result = true;
        }
    }

    return result;
}

bool num_fmt_u32toa( uint32_t value,
                     char * const out,
                     size_t outCap )
{
    bool result = false;


    if( ( out != NULL ) && ( outCap >= 2U ) )
    {
        if( value == 0U )
        {
            out[ 0 ] = '0';
            out[ 1 ] = '\0';
            result = true;
        }
        else
        {
            char tmp[ 11 ]; /* max 10 digits + null */
            uint8_t idx = 0U;

            while( ( value != 0U ) && ( idx < ( uint8_t ) ( sizeof( tmp ) - 1U ) ) )
            {
                tmp[ idx ] = ( char ) ( '0' + ( char ) ( value % 10U ) );
                idx++;
                value /= 10U;
            }

            if( ( ( size_t ) idx + 1U ) <= outCap )
            {
                for( uint8_t i = 0U; i < idx; i++ )
                {
                    out[ i ] = tmp[ ( uint8_t ) ( idx - 1U - i ) ];
                }

                out[ idx ] = '\0';
                result = true;
            }
        }
    }

    return result;
}

bool num_fmt_u8toa( uint8_t value,
                    char * const out,
                    size_t outCap )
{
    return num_fmt_u32toa( ( uint32_t ) value, out, outCap );
}

bool num_fmt_u32_to_hex8( uint32_t v,
                          char * const out,
                          size_t outCap )
{
    bool result = false;

    if( ( out != NULL ) && ( outCap >= 9U ) )
    {
        for( uint8_t i = 0U; i < 8U; i++ )
        {
            uint8_t shift = ( uint8_t ) ( 28U - ( i * 4U ) );
            out[ i ] = num_fmt_hex_nibble_to_char( ( uint8_t ) ( v >> shift ) );
        }

        out[ 8 ] = '\0';
        result = true;
    }

    return result;
}

char * num_fmt_append_u16( char * p, uint16_t value )
{
    char tmp[ 6 ]; /* max 5 digits + 1 */
    int i = 0;

    do
    {
        tmp[ i++ ] = ( char ) ( '0' + ( value % 10U ) );
        value /= 10U;
    }
    while( value != 0U );

    while( i > 0 ) 
    {
        *p++ = tmp[ --i ];
    }

    return p;
}

char * num_fmt_append_fixed1( char * p, uint16_t tenths )
{
    p = num_fmt_append_u16( p, tenths / 10U );
    *p++ = '.';
    *p++ = ( char ) ( '0' + ( tenths % 10U ) );
    return p;
}

/**
 * @brief Convert a 4-bit value (nibble) to an uppercase hexadecimal character.
 *
 * Converts the least-significant 4 bits of the input value into its
 * corresponding ASCII hexadecimal representation ('0'–'9', 'A'–'F').
 *
 * @param value  Value containing the nibble to convert (only the lower 4 bits
 *               are used).
 *
 * @return ASCII character representing the hexadecimal value.
 *
 * @note Output is uppercase and matches the formatting of "%X".
 */
static char num_fmt_hex_nibble_to_char( uint8_t value )
{
    char result;

    value = ( uint8_t ) ( value & 0x0FU );

    if( value < 10U )
    {
        result = ( char ) ( '0' + ( char ) value );
    }
    else
    {
        result = ( char ) ( 'A' + ( char ) ( value - 10U ) );
    }

    return result;
}
