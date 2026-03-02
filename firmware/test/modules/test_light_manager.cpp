#include <gtest/gtest.h>
#include <gmock/gmock.h>
#include "light_manager.hpp"
#include "lib/mock_light_sensor.hpp"

using namespace light;
using ::testing::_;
using ::testing::DoAll;
using ::testing::Return;
using ::testing::SetArgReferee;

class ManagerTest : public ::testing::Test
{
protected:
    static constexpr uint8_t kStepsPerSecond = 60U;

    void SetUp() override
    {
        mgr_ = std::make_unique<Manager>( sensor_, kStepsPerSecond );
    }

    MockLightSensor          sensor_;
    std::unique_ptr<Manager> mgr_;
};

TEST_F( ManagerTest, InitialStateNotRamping )
{
    EXPECT_FALSE( mgr_->isRamping() );
}

TEST_F( ManagerTest, InitialTargetIsZero )
{
    EXPECT_EQ( mgr_->getTarget(), 0U );
}

TEST_F( ManagerTest, StepIntervalMs )
{
    EXPECT_EQ( mgr_->stepIntervalMs(), 1000U / kStepsPerSecond );
}

TEST_F( ManagerTest, SetTargetSameLevelNotRamping )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 50U ), Return( true ) ) );

    mgr_->setTarget( 50U, kStepsPerSecond );
    EXPECT_FALSE( mgr_->isRamping() );
}

TEST_F( ManagerTest, SetTargetDifferentLevelStartsRamping )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) );

    mgr_->setTarget( 100U, kStepsPerSecond );
    EXPECT_TRUE( mgr_->isRamping() );
    EXPECT_EQ( mgr_->getTarget(), 100U );
}

TEST_F( ManagerTest, SetTargetZeroStepsPerSecondClampedToOne )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) );

    mgr_->setTarget( 50U, 0U );
    EXPECT_EQ( mgr_->stepIntervalMs(), 1000U );
}

TEST_F( ManagerTest, SetTargetUpdatesStepsPerSecond )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) );

    mgr_->setTarget( 50U, 10U );
    EXPECT_EQ( mgr_->stepIntervalMs(), 100U );
}

TEST_F( ManagerTest, StepRampsUpByOne )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) )  /* setTarget */
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) ); /* step */
    EXPECT_CALL( sensor_, setLevel( 1U ) )
        .WillOnce( Return( true ) );

    mgr_->setTarget( 10U, kStepsPerSecond );
    mgr_->step();
}

TEST_F( ManagerTest, StepRampsUpToTarget )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) )  /* setTarget */
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) )  /* step 1 */
        .WillOnce( DoAll( SetArgReferee<0>( 1U ), Return( true ) ) )  /* step 2 */
        .WillOnce( DoAll( SetArgReferee<0>( 2U ), Return( true ) ) )  /* step 3 */
        .WillOnce( DoAll( SetArgReferee<0>( 3U ), Return( true ) ) )  /* step 4 */
        .WillOnce( DoAll( SetArgReferee<0>( 4U ), Return( true ) ) ); /* step 5 */
    EXPECT_CALL( sensor_, setLevel( _ ) )
        .Times( 5 )
        .WillRepeatedly( Return( true ) );

    mgr_->setTarget( 5U, kStepsPerSecond );

    for( uint8_t i = 0U; i < 4U; ++i )
    {
        mgr_->step();
        EXPECT_TRUE( mgr_->isRamping() );
    }

    const bool done = mgr_->step();
    EXPECT_TRUE( done );
    EXPECT_FALSE( mgr_->isRamping() );
}

TEST_F( ManagerTest, StepReturnsTrueWhenRampComplete )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) )  /* setTarget */
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) ); /* step */
    EXPECT_CALL( sensor_, setLevel( 1U ) )
        .WillOnce( Return( true ) );

    mgr_->setTarget( 1U, kStepsPerSecond );
    const bool done = mgr_->step();
    EXPECT_TRUE( done );
}

TEST_F( ManagerTest, StepRampsDownByOne )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 10U ), Return( true ) ) ) /* setTarget */
        .WillOnce( DoAll( SetArgReferee<0>( 10U ), Return( true ) ) ); /* step */
    EXPECT_CALL( sensor_, setLevel( 9U ) )
        .WillOnce( Return( true ) );

    mgr_->setTarget( 0U, kStepsPerSecond );
    mgr_->step();
}

TEST_F( ManagerTest, StepDoesNotUnderflowAtZero )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) ); /* setTarget — already at target */

    mgr_->setTarget( 0U, kStepsPerSecond );
    EXPECT_FALSE( mgr_->isRamping() );

    /* step should not call getLevel or setLevel since not ramping */
    mgr_->step();
}

TEST_F( ManagerTest, RampUpToMaxLevel )
{
    ::testing::InSequence seq;

    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) ); /* setTarget */

    for( uint8_t i = 0U; i < 255U; ++i )
    {
        EXPECT_CALL( sensor_, getLevel( _ ) )
            .WillOnce( DoAll( SetArgReferee<0>( i ), Return( true ) ) );
        EXPECT_CALL( sensor_, setLevel( static_cast<uint8_t>( i + 1U ) ) )
            .WillOnce( Return( true ) );
    }

    mgr_->setTarget( 0xFFU, kStepsPerSecond );

    for( uint16_t i = 0U; i < 255U; ++i )
    {
        mgr_->step();
    }

    EXPECT_FALSE( mgr_->isRamping() );
}

TEST_F( ManagerTest, StepGetLevelFailureLeavesRampingUnchanged )
{
    EXPECT_CALL( sensor_, getLevel( _ ) )
        .WillOnce( DoAll( SetArgReferee<0>( 0U ), Return( true ) ) )  /* setTarget */
        .WillOnce( Return( false ) );                                  /* step — fail */
    EXPECT_CALL( sensor_, setLevel( _ ) ).Times( 0 );

    mgr_->setTarget( 50U, kStepsPerSecond );
    EXPECT_TRUE( mgr_->isRamping() );

    mgr_->step();
    EXPECT_TRUE( mgr_->isRamping() );
}

TEST_F( ManagerTest, StepReturnsTrueWhenNotRamping )
{
    /* No getLevel or setLevel calls expected when not ramping */
    EXPECT_CALL( sensor_, getLevel( _ ) ).Times( 0 );
    EXPECT_CALL( sensor_, setLevel( _ ) ).Times( 0 );

    EXPECT_FALSE( mgr_->isRamping() );
    const bool result = mgr_->step();
    EXPECT_TRUE( result );
}
