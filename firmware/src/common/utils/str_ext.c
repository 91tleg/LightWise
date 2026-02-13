#include "str_ext.h"

#include <string.h>
#include <limits.h>

bool str_ext_get_field( const uint8_t * const buf,
                        size_t len,
                        size_t pos,
                        uint8_t fieldIndex,
                        size_t * const outStart,
                        size_t * const outLen )
{
    bool result = false;

    if( ( buf != NULL ) && ( outStart != NULL ) && ( outLen != NULL ) && ( pos < len ) )
    {
        uint8_t idx = 0U;
        size_t start = pos; /* Field 0 starts at pos */

        for( size_t i = pos; i <= len; ++i )
        {
            bool isEnd = ( i == len );
            bool isComma = ( !isEnd ) && ( buf[ i ] == ( uint8_t ) ',' );

            if( isEnd || isComma )
            {
                if( idx == fieldIndex )
                {
                    *outStart = start;
                    *outLen = ( i >= start ) ? ( i - start ) : 0U;
                    result = true;
                    break;
                }
                idx++;
                start = i + 1U;
            }
        }
    }

    return result;
}

bool str_ext_parse_x100( const uint8_t * const str, 
                         size_t len,
                         int32_t * const outVal )
{
    bool result = false;

    if( ( str != NULL ) && ( outVal != NULL ) && ( len > 0U ) )
    {
        size_t i = 0U;
        bool isNegative = false;
        bool seenDigit = false;
        bool seenDot = false;

        int32_t intPart = 0;
        int32_t fracPart = 0;
        uint8_t fracDigits = 0U;

        if( str[ 0 ] == ( uint8_t ) '-' )
        {
            isNegative = true;
            i = 1U;
        }

        if( i < len )
        {
            for( ; i < len; ++i )
            {
                uint8_t c = str[ i ];

                if( ( c >= ( uint8_t ) '0' ) && ( c <= ( uint8_t ) '9' ) )
                {
                    seenDigit = true;

                    if( !seenDot )
                    {
                        if( intPart > ( INT32_MAX / 10 ) )
                        {
                            break;
                        }
                        intPart = ( intPart * 10 ) + ( int32_t ) ( c - '0' );
                    }
                    else if( fracDigits < 2U )
                    {
                        fracPart = ( fracPart * 10 ) + ( int32_t ) ( c - '0' );
                        fracDigits++;
                    }
                }
                else if( c == ( uint8_t ) '.' )
                {
                    if( seenDot )
                    {
                        break;
                    }
                    seenDot = true;
                }
                else
                {
                    break;
                }
            }

            if( ( i == len ) && ( seenDigit ) &&
                !( seenDot && ( fracDigits == 0U ) ) )
            {
                if( fracDigits == 1U )
                {
                    fracPart *= 10;
                }
                else if( fracDigits == 0U )
                {
                    fracPart = 0;
                }
                else
                {
                    /* Nothing */
                }

                if( intPart <= ( INT32_MAX / 100 ) )
                {
                    int32_t value = ( intPart * 100 ) + fracPart;
                    *outVal = isNegative ? -value : value;
                    result = true;
                }
            }
        }
    }

    return result;
}

bool str_ext_to_upper_case( char * str )
{
    bool result = false;

    if( str != NULL )
    {
        size_t i = 0U;

        while( str[ i ] != '\0' )
        {
            if( ( str[ i ] >= 'a' ) && ( str[ i ] <= 'z' ) )
            {
                str[ i ] = ( char ) ( str[ i ] - ( 'a' - 'A' ) );
            }
            i++;
        }
        result = true;
    }

    return result;
}


bool str_ext_starts_with( const uint8_t * const buf, 
                          size_t len, 
                          const char * const prefix, 
                          size_t prefixLen )
{
    bool result = false;

    if( ( buf != NULL ) && ( prefix != NULL ) && 
        ( len >= prefixLen ) && ( prefixLen > 0U ) )
    {
        if( memcmp( buf, prefix, prefixLen ) == 0 )
        {
            result = true;
        }
    }

    return result;
}

size_t str_ext_strnlen( const char * const str, 
                        size_t cap )
{
    size_t index = 0U;

    if( str != NULL )
    {
        while( ( index < cap ) && ( str[ index ] != '\0' ) )
        {
            index++;
        }
    }

    return index;
}

int str_ext_buf_find_char( const uint8_t * const buf, 
                           size_t len,
                           uint8_t ch )
{
    if( buf != NULL )
    {
        for( size_t index = 0U; index < len; ++index )
        {
            if( buf[ index ] == ch )
            {
                return ( int ) index;
            }
        }
    }
    return -1;
}

bool str_ext_uint8_array_to_hex_string( const uint8_t * const in,
                                        size_t len,
                                        char * const out,
                                        size_t outSize )
{
    bool result = false;
    static const char HEX[] = "0123456789ABCDEF";
    const size_t required = ( len * 2U ) + 1U;

    if( ( in != NULL ) && ( out != NULL ) && ( outSize >= required ) )
    {
        for( size_t i = 0; i < len; ++i )
        {
            out[ i * 2U ] = HEX[ ( in[ i ] >> 4 ) & 0x0F ];
            out[ i * 2U + 1 ] = HEX[ in[ i ] & 0x0F ];
        }

        out[ len * 2U ] = '\0';
        result = true;
    }

    return result;
}
