#include "aht20.hpp"

#include <array>
#include <cstdint>

#include "hal/aht20.h"
#include "utils/time/delay.h"

namespace th
{

    namespace
    {

        constexpr uint8_t kCmdSoftReset      { 0xBAU };
        constexpr uint8_t kCmdCalibrate      { 0xE1U };
        constexpr uint8_t kCmdTrigger        { 0xACU };

        constexpr uint8_t kCalibArgs[]       { 0x08U, 0x00U };
        constexpr uint8_t kTriggerArgs[]     { 0x33U, 0x00U };

        constexpr uint8_t kStatusBusy        { 0x80U };
        constexpr uint8_t kStatusCalibrated  { 0x08U };

        constexpr uint32_t kResetDelayMs     { 20U };
        constexpr uint32_t kBusyPollMs       { 10U };
        constexpr uint8_t  kBusyPollMaxTries { 10U };

    } /* anonymous namespace */

    uint8_t Aht20::status() const noexcept
    {
        uint8_t s { 0xFFU };
        static_cast< void >( aht20_hal_read_raw( &hw_, &s, sizeof( s ) ) );
        return s;
    }

    bool Aht20::isBusy() const noexcept
    {
        return ( status() & kStatusBusy ) != 0U;
    }

    bool Aht20::init() noexcept
    {
        bool ok { aht20_hal_write( &hw_, kCmdSoftReset, nullptr, 0U ) };

        if( ok )
        {
            delay_ms( kResetDelayMs );

            uint8_t tries { 0U };
            while( isBusy() && ( tries < kBusyPollMaxTries ) )
            {
                delay_ms( kBusyPollMs );
                ++tries;
            }
            ok = ( tries < kBusyPollMaxTries );
        }

        if( ok )
        {
            ok = aht20_hal_write( &hw_,
                                  kCmdCalibrate,
                                  kCalibArgs,
                                  sizeof( kCalibArgs ) );
        }

        if( ok )
        {
            uint8_t tries { 0U };
            while( isBusy() && ( tries < kBusyPollMaxTries ) )
            {
                delay_ms( kBusyPollMs );
                ++tries;
            }
            ok = ( tries < kBusyPollMaxTries );
        }

        if( ok )
        {
            ok = ( status() & kStatusCalibrated ) != 0U;
        }

        return ok;
    }

    bool Aht20::read( int8_t & temperature,
                      uint8_t & humidity ) const noexcept
    {
        bool ok { aht20_hal_write( &hw_,
                                   kCmdTrigger,
                                   kTriggerArgs,
                                   sizeof( kTriggerArgs ) ) };

        if( ok )
        {
            uint8_t tries { 0U };
            while( isBusy() && ( tries < kBusyPollMaxTries ) )
            {
                delay_ms( kBusyPollMs );
                ++tries;
            }
            ok = ( tries < kBusyPollMaxTries );
        }

        if( ok )
        {
            std::array< uint8_t, 6U > data {};
            ok = aht20_hal_read_raw( &hw_, data.data(), data.size() );

            if( ok )
            {
                /* Humidity — 20-bit value in bits [39:20] */
                uint32_t hRaw { static_cast< uint32_t >( data[ 1U ] ) };
                hRaw <<= 8U;
                hRaw |= data[ 2U ];
                hRaw <<= 4U;
                hRaw |= ( data[ 3U ] >> 4U );

                humidity = static_cast< uint8_t >(
                            ( hRaw * 100UL ) / 0x100000UL );

                /* Temperature — 20-bit value in bits [19:0] */
                uint32_t tRaw { static_cast< uint32_t >( data[ 3U ] & 0x0FU ) };
                tRaw <<= 8U;
                tRaw |= data[ 4U ];
                tRaw <<= 8U;
                tRaw |= data[ 5U ];

                temperature = static_cast< int8_t >(
                    ( ( tRaw * 200UL ) / 0x100000UL ) - 50UL );
            }
        }

        return ok;
    }

} /* namespace th */
