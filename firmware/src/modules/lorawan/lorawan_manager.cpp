#include "lorawan_manager.hpp"

#include "types/lorawan_data.hpp"
#include "types/lorawan_keys.hpp"
#include "utils/log/log.h"
#include "utils/time/delay.h"
#include "payloads/uplink_payload.hpp"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANManager" };

    } /* anonymous namespace */

    Manager::Manager( LorawanSensor & device,
                      UplinkPayload & payload,
                      std::span< uint8_t > buf ) noexcept
        : device_ { device }
        , payload_ { payload }
        , buf_ { buf }
        , mutexBuffer_ {}
        , mutex_ { xSemaphoreCreateMutexStatic( &mutexBuffer_ ) }
        , state_ { State::UNINITIALISED }
        , lastJoinMs_ { 0U }
    {
        configASSERT( mutex_ != nullptr );
    }

    bool Manager::setup( const Keys & keys ) noexcept
    {
        bool result { false };

        state_ = State::CONFIGURING;

        /* Keys are provisioned to the device then zeroed */
        Keys localKeys { keys };

        if( !device_.get().setAppKey( localKeys.appKey.data() ) )
        {
            LOGE( kTag, "setAppKey failed" );
            state_ = State::FAILED;
        }
        else if( !device_.get().setAppEui( localKeys.appEui.data() ) )
        {
            LOGE( kTag, "setAppEui failed" );
            state_ = State::FAILED;
        }
        else if( !device_.get().begin() )
        {
            LOGE( kTag, "begin failed" );
            state_ = State::FAILED;
        }
        else if( !configure() )
        {
            state_ = State::FAILED;
        }
        else
        {
            result = issueJoin();
        }

        /* Zero local key copy immediately after provisioning. */
        localKeys = Keys{};

        return result;
    }

    bool Manager::issueJoin() noexcept
    {
        bool result { false };

        if( device_.get().join() )
        {
            LOGI( kTag, "JOIN request sent — waiting for accept" );
            state_      = State::JOINING;
            lastJoinMs_ = 0U;  /* caller sets time on first call */
            result      = true;
        }
        else
        {
            LOGE( kTag, "join failed" );
            state_ = State::FAILED;
        }

        return result;
    }

    bool Manager::tryAdvanceJoin( uint32_t nowMs ) noexcept
    {
        bool ready { false };

        if( state_ == State::JOINING )
        {
            if( device_.get().isJoined() )
            {
                LOGI( kTag, "JOIN successful" );
                state_ = State::READY;
                ready  = true;
            }
            else if( ( nowMs - lastJoinMs_ ) >= kJoinRetryMs )
            {
                /* Network has not responded — re-issue join request.
                * Failure here stays in JOINING so the next call retries. */
                LOGI( kTag, "JOIN timeout: retrying" );
                lastJoinMs_ = nowMs;

                if( !device_.get().join() )
                {
                    LOGW( kTag, "join retry failed" );
                }
            }
            else
            {
                /* Still within the wait window — nothing to do. */
            }
        }
        else if( state_ == State::READY )
        {
            ready = true;
        }
        else
        {
            /* UNINITIALISED or FAILED — caller must call setup() first. */
        }

        return ready;
    }

    bool Manager::isReady() const noexcept
    {
        return ( state_ == State::READY );
    }

    Manager::State Manager::state() const noexcept
    {
        return state_;
    }

    bool Manager::configure() noexcept
    {
        bool ok { true };

        if( ok && !device_.get().setRegion( kRegion ) )
        {
            LOGE( kTag, "setRegion failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().setClass( kDeviceClass ) )
        {
            LOGE( kTag, "setClass failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().setDatarate( kDatarate ) )
        {
            LOGE( kTag, "setDatarate failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().setEirp( kEirp ) )
        {
            LOGE( kTag, "setEirp failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().setSubband( kSubband ) )
        {
            LOGE( kTag, "setSubband failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().enableAdr( kAdrEnabled ) )
        {
            LOGE( kTag, "enableAdr failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        if( ok && !device_.get().setPacketType( kPacketType ) )
        {
            LOGE( kTag, "setPacketType failed" );
            ok = false;
        }
        delay_ms( kSetupDelayMs );

        return ok;
    }

    bool Manager::sendUplink( const UplinkData & data ) noexcept
    {
        bool result { false };

        if( isReady() )
        {
            payload_.get().encode( data, buf_ );

            const MutexGuard guard { mutex_ };

            if( guard.locked() )
            {
                result = device_.get().sendPacket(
                            buf_.data(),
                            static_cast< uint8_t >( buf_.size() ) );
            }
            else
            {
                LOGE( kTag, "sendUplink: failed to acquire mutex" );
            }
        }

        return result;
    }

    void Manager::pollReceive() noexcept
    {
        /* sleepMs() is intentionally outside the mutex scope — sleeping under
         * a lock would block sendUplink() for the full kPollWindowMs.          */
        {
            const MutexGuard guard { mutex_ };

            if( !guard.locked() )
            {
                LOGE( kTag, "pollReceive: failed to acquire mutex" );
                return;
            }
        } /* mutex released here */

        device_.get().sleepMs( kPollWindowMs );
    }

} /* namespace lorawan */
