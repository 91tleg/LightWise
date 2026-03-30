#include "lorawan_manager.hpp"

#include "types/lorawan_keys.hpp"
#include "utils/log/log.h"
#include "utils/time/delay.h"
#include "utils/security/secure_zero.hpp"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANManager" };

    } /* anonymous namespace */

    Manager::Manager( LorawanSensor & device ) noexcept
        : device_ { device }
        , mutexBuffer_ {}
        , mutex_ { xSemaphoreCreateMutexStatic( &mutexBuffer_ ) }
        , state_ { State::UNINITIALIZED }
        , lastJoinMs_ { 0U }
    {
        configASSERT( mutex_ != nullptr );
    }

    bool Manager::setup( const Keys & keys, uint32_t nowMs ) noexcept
    {
        bool ok { false };
        const MutexGuard guard { mutex_ };

        if( guard.locked() )
        {
            state_ = State::CONFIGURING;

            Keys localKeys { keys };

            ok = ( device_.setAppKey( localKeys.appKey.data() ) &&
                   device_.setAppEui( localKeys.appEui.data() ) &&
                   device_.begin()                              &&
                   configure() );

            security::secureZero( localKeys );

            if( ok )
            {
                ok = issueJoin( nowMs );
            }
            else
            {
                LOGE( kTag, "setup failed — caller should retry" );
                state_ = State::UNINITIALIZED;
            }
        }

        return ok;
    }

    bool Manager::issueJoin( uint32_t nowMs ) noexcept
    {
        /* Called from setup() which holds mutex_ — do not acquire here */
        bool result { false };
        if( device_.join() )
        {
            LOGI( kTag, "JOIN request sent — waiting for accept" );
            state_ = State::JOINING;
            lastJoinMs_ = nowMs;  /* start retry window from now */
            result      = true;
        }
        else
        {
            LOGE( kTag, "issueJoin failed — rewinding to UNINITIALIZED" );
            state_ = State::UNINITIALIZED;
        }
        return result;
    }

    bool Manager::tryAdvanceJoin( uint32_t nowMs ) noexcept
    {
        bool ready { false };
        const MutexGuard guard { mutex_ };

        if( guard.locked() )
        {
            if( state_ == State::JOINING )
            {
                if( device_.isJoined() )
                {
                    LOGI( kTag, "JOIN successful" );
                    state_ = State::READY;
                    ready  = true;
                }
                else if( ( nowMs - lastJoinMs_ ) >= kJoinRetryMs )
                {
                    /* Failure stays in JOINING so the next call retries. */
                    LOGI( kTag, "JOIN timeout: retrying" );
                    lastJoinMs_ = nowMs;

                    if( !device_.join() )
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
                /* UNINITIALIZED — caller must call setup() first. */
            }
        }

        return ready;
    }

    bool Manager::isReady() const noexcept
    {
        const MutexGuard guard { mutex_ };
        return guard.locked() && ( state_ == State::READY );
    }

    Manager::State Manager::state() const noexcept
    {
        const MutexGuard guard { mutex_ };
        return guard.locked() ? state_ : State::UNINITIALIZED;
    }

    void Manager::setRxCb( LorawanSensor::RxCallback cb ) noexcept
    {
        const MutexGuard guard { mutex_ };
        if( guard.locked() )
        {
            device_.setRxCb( cb );
        }
    }

    bool Manager::configure() noexcept
    {
        /* Called from setup() which holds mutex_ — do not acquire here */
        bool ok { true };

        if( ok && !device_.setRegion( kRegion ) )
        {
            LOGE( kTag, "setRegion failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.setClass( kDeviceClass ) )
        {
            LOGE( kTag, "setClass failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.setDatarate( kDatarate ) )
        {
            LOGE( kTag, "setDatarate failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.setEirp( kEirp ) )
        {
            LOGE( kTag, "setEirp failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.setSubband( kSubband ) )
        {
            LOGE( kTag, "setSubband failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.enableAdr( kAdrEnabled ) )
        {
            LOGE( kTag, "enableAdr failed" );
            ok = false;
        }
        if( ok )
        {
            delay_ms( kSetupDelayMs );
        }

        if( ok && !device_.setPacketType( kPacketType ) )
        {
            LOGE( kTag, "setPacketType failed" );
            ok = false;
        }

        return ok;
    }

    bool Manager::send( std::span< const uint8_t > buf ) noexcept
    {
        bool result { false };
        const MutexGuard guard { mutex_ };
        if( guard.locked() )
        {
            if( state_ == State::READY )
            {
                result = device_.sendPacket( buf.data(),
                                             static_cast< uint8_t >( buf.size() ) );
            }
            else
            {
                LOGW( kTag, "send: not joined — dropping packet" );
            }
        }
        return result;
    }

} /* namespace lorawan */
