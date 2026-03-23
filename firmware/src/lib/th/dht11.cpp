#include "dht11.hpp"

#include <array>

#include "hal/dht11.h"
#include "utils/time/delay.h"
#include "utils/time/timer.h"

namespace th
{

    namespace
    {

        constexpr uint32_t kStartSignalMs { 18U };     /**< Duration of start signal */
        constexpr uint32_t kBitSampleDelayUs { 30U };  /**< Delay before sampling bit */
        constexpr uint32_t kTimeoutUs { 100U };        /**< Timeout for signal level wait */
        constexpr uint32_t kReadDelayMs { 500U };      /**< Delay between reads */
        constexpr uint32_t kReleaseDelayUs   { 40U  }; /**< Host release delay after pull-high */

    } /* anonymous namespace */

    bool Dht11::read( uint8_t & temperature, uint8_t & humidity ) const noexcept
    {
        bool result { false };
        std::array< uint8_t, 5U > data {};

        if( readRaw( data ) )
        {
            humidity = data[ 0U ];
            temperature = data[ 2U ];
            result = true;
        }

        return result;
    }

    bool Dht11::readRaw( std::span< uint8_t, 5U > data ) const noexcept
    {
        bool success { true };

        delay_ms( kReadDelayMs );

        if( !startSignal() || 
            !waitLevel( 0U, kTimeoutUs ) || 
            !waitLevel( 1U, kTimeoutUs ) )
        {
            success = false;
        }

        if( success )
        {
            for( uint8_t i { 0U }; ( i < 5U ) && success; ++i )
            {
                if( !readByte( data[ i ] ) )
                {
                    success = false;
                }
            }
        }

        if( success )
        {
            const uint8_t checksum { static_cast< uint8_t >( data[ 0U ] +
                                                             data[ 1U ] +
                                                             data[ 2U ] +
                                                             data[ 3U ] ) };
            if( checksum != data[ 4U ] )
            {
                success = false;
            }
        }

        return success;
    }

    bool Dht11::readByte( uint8_t & byte ) const noexcept
    {
        bool success { true };
        byte = 0U;

        for( uint8_t i { 0U }; ( i < 8U ) && success; ++i )
        {
            if( !waitLevel( 0U, kTimeoutUs ) || !waitLevel( 1U, kTimeoutUs ) )
            {
                success = false;
            }
            else
            {
                delay_us( kBitSampleDelayUs );

                uint32_t level { 0U };
                if( !dht11_hal_read( &sensor_, &level ) )
                {
                    success = false;
                }
                else if( level == 1U )
                {
                    byte |= static_cast< uint8_t >( 1U << ( 7U - i ) );
                } 
                else
                {
                    /* Bit is 0, do nothing */
                }
            }
        }

        return success;
    }

    bool Dht11::startSignal() const noexcept
    {
        bool success { false };

        if( dht11_hal_set_output( &sensor_ ) )
        {
            if( dht11_hal_write( &sensor_, 0U ) )
            {
                delay_ms( kStartSignalMs );
                
                if( dht11_hal_write( &sensor_, 1U ) )
                {
                    delay_us( kReleaseDelayUs );
                    success = dht11_hal_set_input( &sensor_ );
                }
            }
        }

        return success;
    }

    bool Dht11::waitLevel( uint8_t level, uint32_t timeoutUs ) const noexcept
    {
        bool found { false };
        bool timeout { false };
        const uint64_t startTime { timer_get_time_us() };

        while( !found && !timeout )
        {
            uint32_t currentLevel { 0U };

            if( !dht11_hal_read( &sensor_, &currentLevel ) )
            {
                timeout = true;
            }
            else if( currentLevel == static_cast< uint32_t >( level ) )
            {
                found = true;
            }
            else if( ( timer_get_time_us() - startTime ) > timeoutUs )
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
