#include "dht11.hpp"

#include "hal/dht11.h"

namespace th
{
    namespace
    {
        constexpr uint32_t kStartSignalMs = 18U;     /**< Duration of start signal */
        constexpr uint32_t kBitSampleDelayUs = 30U;  /**< Delay before sampling bit */
        constexpr uint32_t kTimeoutUs = 100U;        /**< Timeout for signal level wait */
        constexpr uint32_t kReadDelayMs = 500U;      /**< Delay between reads */
    } /* anonymous namespace */

    bool Dht11::init()
    {
        bool result = false;

        if( sensor_ != nullptr )
        {
            isInitialized_ = true;
            result = true;
        }
        return result;
    }

    bool Dht11::read( uint8_t & temperature, uint8_t & humidity ) const
    {
        bool result = false;
        uint8_t data[ 5 ]{};
        
        if( isInitialized_ )
        {
            if( readRaw( data ) )
            {
                humidity = data[ 0 ];
                temperature = data[ 2 ];
                result = true;
            }
        }

        return result;
    }

    bool Dht11::readRaw( uint8_t data[ 5 ] ) const
    {
        bool success = true;

        for( uint8_t i = 0U; i < 5U; ++i )
        {
            data[ i ] = 0U;
        }

        dht11_hal_delay_ms( kReadDelayMs );

        if( !startSignal() || 
            !waitLevel( 0U, kTimeoutUs ) || 
            !waitLevel( 1U, kTimeoutUs ) )
        {
            success = false;
        }

        if( success )
        {
            for( uint8_t i = 0U; ( i < 5U ) && success; ++i )
            {
                if( !readByte( data[ i ] ) )
                {
                    success = false;
                }
            }
        }

        if( success )
        {
            const uint8_t checksum = static_cast<uint8_t>( data[ 0 ] +
                                                           data[ 1 ] +
                                                           data[ 2 ] +
                                                           data[ 3 ] );
            if( checksum != data[ 4 ] )
            {
                success = false;
            }
        }

        return success;
    }

    bool Dht11::readByte( uint8_t & byte ) const
    {
        bool success = true;
        byte = 0U;

        for( uint8_t i = 0U; ( i < 8U ) && success; ++i )
        {
            if( !waitLevel( 0U, kTimeoutUs ) || !waitLevel( 1U, kTimeoutUs ) )
            {
                success = false;
            }
            else
            {
                dht11_hal_delay_us( kBitSampleDelayUs );
                
                uint32_t level = 0U;
                if( !dht11_hal_read( sensor_, &level ) )
                {
                    success = false;
                }
                else if( level == 1U )
                {
                    byte |= static_cast<uint8_t>( 1U << ( 7U - i ) );
                } 
                else
                {
                    /* Bit is 0, do nothing */
                }
            }
        }

        return success;
    }

    bool Dht11::startSignal() const
    {
        bool success = false;

        if( dht11_hal_set_output( sensor_ ) )
        {
            if( dht11_hal_write( sensor_, 0U ) )
            {
                dht11_hal_delay_ms( kStartSignalMs );
                
                if( dht11_hal_write( sensor_, 1U ) )
                {
                    dht11_hal_delay_us( 40U );
                    success = dht11_hal_set_input( sensor_ );
                }
            }
        }

        return success;
    }

    bool Dht11::waitLevel( uint8_t level, uint32_t timeoutUs ) const
    {
        bool found = false;
        bool timeout = false;
        const uint64_t startTime = dht11_hal_get_time_us();

        while( !found && !timeout )
        {
            uint32_t currentLevel = 0U;
            
            if( !dht11_hal_read( sensor_, &currentLevel ) )
            {
                timeout = true;
            }
            else if( currentLevel == static_cast<uint32_t>( level ) )
            {
                found = true;
            }
            else if( ( dht11_hal_get_time_us() - startTime ) > timeoutUs )
            {
                timeout = true;
            }
            else
            {
                /* Keep polling */
            }
        }

        return found;
    }
} /* namespace th */
