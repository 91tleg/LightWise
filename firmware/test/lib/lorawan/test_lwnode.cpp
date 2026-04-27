#include <gtest/gtest.h>
#include <cstring>
#include <string>
#include <algorithm>

#include "hal/lwnode.h"
#include "lib/lorawan/lwnode.hpp"

using namespace lorawan;

extern "C" {

    /* Internal mock state */
    static uint8_t s_readData[ 128U ] {};
    static size_t s_readDataLen { 0U };
    static uint8_t s_lastWriteReg { 0U };
    static uint8_t s_lastReadReg { 0U };
    static uint8_t s_lastWriteData[ 128U ] {};
    static size_t s_lastWriteLen { 0U };
    static bool s_initRetVal { true };
    static bool s_writeRetVal { true };
    static bool s_readRetVal { true };
    static uint8_t s_allWriteData[ 512U ] {};
    static size_t s_allWriteLen { 0U };

    void delay_ms( uint32_t delayMs )
    {
        ( void ) delayMs;
    }

    bool lwnode_hal_init( LwnodeHw * sensor )
    {
        ( void ) sensor;
        return s_initRetVal;
    }

    bool lwnode_hal_deinit( LwnodeHw * sensor )
    {
        ( void )sensor;
        return true;
    }

    bool lwnode_hal_write( const LwnodeHw * sensor,
                        uint8_t reg,
                        const uint8_t * data,
                        size_t len )
    {
        ( void ) sensor;
        s_lastWriteReg = reg;
        s_lastWriteLen = len;
        const size_t copy { std::min( len, sizeof( s_lastWriteData ) ) };
        std::copy_n( data, copy, s_lastWriteData );

        const size_t space { sizeof( s_allWriteData ) - s_allWriteLen };
        const size_t append { std::min( len, space ) };
        std::copy_n( data, append, &s_allWriteData[ s_allWriteLen ] );
        s_allWriteLen += append;

        return s_writeRetVal;
    }

    bool lwnode_hal_read( const LwnodeHw * sensor,
                          uint8_t reg,
                          uint8_t * data,
                          size_t len )
    {
        ( void ) sensor;
        s_lastReadReg = reg;
        const size_t copy { std::min( { len, s_readDataLen, sizeof( s_readData ) } ) };
        std::copy_n( s_readData, copy, data );
        return s_readRetVal;
    }

} /* extern "C" */

namespace mock::hal::lwnode
{

    std::string allWriteString()
    {
        return std::string{ reinterpret_cast< const char * >( s_allWriteData ),
                            s_allWriteLen };
    }

    void setReadData( const uint8_t * data, size_t len )
    {
        const size_t copy { std::min( len, sizeof( s_readData ) ) };
        std::copy_n( data, copy, s_readData );
        s_readDataLen = copy;
    }

    void setReadString( const char * str )
    {
        setReadData( reinterpret_cast< const uint8_t * >( str ),
                     std::strlen( str ) );
    }

    void setInitReturn( bool val )
    {
        s_initRetVal  = val;
    }

    void setWriteReturn( bool val ) 
    {
        s_writeRetVal = val;
    }

    void setReadReturn( bool val )
    {
        s_readRetVal  = val;
    }

    uint8_t lastWriteReg()
    {
        return s_lastWriteReg;
    }

    uint8_t lastReadReg()
    {
        return s_lastReadReg;
    }

    const uint8_t * lastWriteData()
    {
        return s_lastWriteData;
    }

    size_t lastWriteLen()
    {
        return s_lastWriteLen;
    }

    std::string lastWriteString()
    {
        return std::string{ reinterpret_cast< const char * >( s_lastWriteData ),
                            s_lastWriteLen };
    }

    void reset()
    {
        std::fill( std::begin( s_allWriteData ), std::end( s_allWriteData ), 0U );
        std::fill( std::begin( s_readData ), std::end( s_readData ), 0U );
        std::fill( std::begin( s_lastWriteData ), std::end( s_lastWriteData ), 0U );
        s_readDataLen  = 0U;
        s_allWriteLen = 0U;
        s_lastWriteReg = 0U;
        s_lastReadReg  = 0U;
        s_lastWriteLen = 0U;
        s_initRetVal   = true;
        s_writeRetVal  = true;
        s_readRetVal   = true;
    }

} /* namespace mock::hal::lwnode */

class SetRegionTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode node { hw };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetRegionTest, ReturnsTrueForEU868 )
{
    givenAckResponse( "+REGION=OK\r\n" );
    EXPECT_TRUE( node.setRegion( LorawanSensor::Region::EU868 ) );
}

TEST_F( SetRegionTest, ReturnsTrueForUS915 )
{
    givenAckResponse( "+REGION=OK\r\n" );
    EXPECT_TRUE( node.setRegion( LorawanSensor::Region::US915 ) );
}

TEST_F( SetRegionTest, ReturnsTrueForCN470 )
{
    givenAckResponse( "+REGION=OK\r\n" );
    EXPECT_TRUE( node.setRegion( LorawanSensor::Region::CN470 ) );
}

TEST_F( SetRegionTest, WritesEU868Command )
{
    givenAckResponse( "+REGION=OK\r\n" );
    static_cast< void >( node.setRegion( LorawanSensor::Region::EU868 ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+REGION=EU868" ),
               std::string::npos );
}

TEST_F( SetRegionTest, WritesUS915Command )
{
    givenAckResponse( "+REGION=OK\r\n" );
    static_cast< void >( node.setRegion( LorawanSensor::Region::US915 ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+REGION=US915" ),
               std::string::npos );
}

TEST_F( SetRegionTest, WritesCN470Command )
{
    givenAckResponse( "+REGION=OK\r\n" );
    static_cast< void >( node.setRegion( LorawanSensor::Region::CN470 ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+REGION=CN470" ),
               std::string::npos );
}

TEST_F( SetRegionTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+REGION=FAIL\r\n" );
    EXPECT_FALSE( node.setRegion( LorawanSensor::Region::EU868 ) );
}

TEST_F( SetRegionTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setRegion( LorawanSensor::Region::EU868 ) );
}

TEST_F( SetRegionTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setRegion( LorawanSensor::Region::EU868 ) );
}

TEST_F( SetRegionTest, ReturnsFalseForInvalidRegion )
{
    EXPECT_FALSE( node.setRegion( static_cast< LorawanSensor::Region >( 0xFFU ) ) );
}

TEST_F( SetRegionTest, DoesNotWriteForInvalidRegion )
{
    static_cast< void >( node.setRegion( static_cast< LorawanSensor::Region >( 0xFFU ) ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

class SetAppEuiTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode node { hw };

    static constexpr const char * kValidEui      { "70B3D57ED0000001" };
    static constexpr const char * kValidEuiLower { "70b3d57ed0000001" };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetAppEuiTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+JOINEUI=OK\r\n" );
    EXPECT_TRUE( node.setAppEui( kValidEui ) );
}

TEST_F( SetAppEuiTest, ReturnsFalseForNullPtr )
{
    EXPECT_FALSE( node.setAppEui( nullptr ) );
}

TEST_F( SetAppEuiTest, DoesNotWriteForNullPtr )
{
    static_cast< void >( node.setAppEui( nullptr ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

TEST_F( SetAppEuiTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+JOINEUI=FAIL\r\n" );
    EXPECT_FALSE( node.setAppEui( kValidEui ) );
}

TEST_F( SetAppEuiTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setAppEui( kValidEui ) );
}

TEST_F( SetAppEuiTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setAppEui( kValidEui ) );
}

TEST_F( SetAppEuiTest, WrittenCmdContainsPrefix )
{
    givenAckResponse( "+JOINEUI=OK\r\n" );
    static_cast< void >( node.setAppEui( kValidEui ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+JOINEUI=" ),
               std::string::npos );
}

TEST_F( SetAppEuiTest, UppercasesLowerCaseEui )
{
    givenAckResponse( "+JOINEUI=OK\r\n" );
    static_cast< void >( node.setAppEui( kValidEuiLower ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "70B3D57ED0000001" ),
               std::string::npos );
}

TEST_F( SetAppEuiTest, NoLowerCaseHexInWrittenCmd )
{
    givenAckResponse( "+JOINEUI=OK\r\n" );
    static_cast< void >( node.setAppEui( kValidEuiLower ) );
    const std::string cmd { mock::hal::lwnode::lastWriteString() };
    const auto pos { cmd.find( '=' ) };
    ASSERT_NE( pos, std::string::npos );
    const std::string eui { cmd.substr( pos + 1U ) };
    EXPECT_EQ( eui.find_first_of( "abcdef" ), std::string::npos );
}

class SetAppKeyTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    static constexpr const char * kValidKey      { "2B7E151628AED2A6ABF7158809CF4F3C" };
    static constexpr const char * kValidKeyLower { "2b7e151628aed2a6abf7158809cf4f3c" };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetAppKeyTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+APPKEY=OK\r\n" );
    EXPECT_TRUE( node.setAppKey( kValidKey ) );
}

TEST_F( SetAppKeyTest, ReturnsFalseForNullPtr )
{
    EXPECT_FALSE( node.setAppKey( nullptr ) );
}

TEST_F( SetAppKeyTest, DoesNotWriteForNullPtr )
{
    static_cast< void >( node.setAppKey( nullptr ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

TEST_F( SetAppKeyTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+APPKEY=FAIL\r\n" );
    EXPECT_FALSE( node.setAppKey( kValidKey ) );
}

TEST_F( SetAppKeyTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setAppKey( kValidKey ) );
}

TEST_F( SetAppKeyTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setAppKey( kValidKey ) );
}

TEST_F( SetAppKeyTest, WrittenCmdContainsPrefix )
{
    givenAckResponse( "+APPKEY=OK\r\n" );
    static_cast< void >( node.setAppKey( kValidKey ) );
    EXPECT_NE( mock::hal::lwnode::allWriteString().find( "AT+APPKEY=" ),
               std::string::npos );
}

TEST_F( SetAppKeyTest, UppercasesLowerCaseKey )
{
    givenAckResponse( "+APPKEY=OK\r\n" );
    static_cast< void >( node.setAppKey( kValidKeyLower ) );
    EXPECT_NE( mock::hal::lwnode::allWriteString().find( "2B7E151628AED2A6ABF7158809CF4F3C" ),
               std::string::npos );
}

TEST_F( SetAppKeyTest, NoLowerCaseHexInWrittenCmd )
{
    givenAckResponse( "+APPKEY=OK\r\n" );
    static_cast< void >( node.setAppKey( kValidKeyLower ) );
    const std::string cmd { mock::hal::lwnode::allWriteString() };
    const auto pos { cmd.find( '=' ) };
    ASSERT_NE( pos, std::string::npos );
    const std::string key { cmd.substr( pos + 1U ) };
    EXPECT_EQ( key.find_first_of( "abcdef" ), std::string::npos );
}

class SetNwkSkeyTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    /* 32 hex chars = 16 byte key */
    static constexpr const char * kValidKey { "2B7E151628AED2A6ABF7158809CF4F3C" };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetNwkSkeyTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+NWKSKEY=OK\r\n" );
    EXPECT_TRUE( node.setNwkSkey( kValidKey ) );
}

TEST_F( SetNwkSkeyTest, ReturnsFalseForNullPtr )
{
    EXPECT_FALSE( node.setNwkSkey( nullptr ) );
}

TEST_F( SetNwkSkeyTest, DoesNotWriteForNullPtr )
{
    static_cast< void >( node.setNwkSkey( nullptr ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

TEST_F( SetNwkSkeyTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+NWKSKEY=FAIL\r\n" );
    EXPECT_FALSE( node.setNwkSkey( kValidKey ) );
}

TEST_F( SetNwkSkeyTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setNwkSkey( kValidKey ) );
}

TEST_F( SetNwkSkeyTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setNwkSkey( kValidKey ) );
}

TEST_F( SetNwkSkeyTest, WrittenCmdContainsPrefix )
{
    givenAckResponse( "+NWKSKEY=OK\r\n" );
    static_cast< void >( node.setNwkSkey( kValidKey ) );
    EXPECT_NE( mock::hal::lwnode::allWriteString().find( "AT+NWKSKEY=" ),
               std::string::npos );
}

TEST_F( SetNwkSkeyTest, ReturnsFalseForWrongLengthKey )
{
    /* 31 chars — one short of the required 32 */
    EXPECT_FALSE( node.setNwkSkey( "2B7E151628AED2A6ABF7158809CF4F3" ) );
}

class SetAppSkeyTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    static constexpr const char * kValidKey { "2B7E151628AED2A6ABF7158809CF4F3C" };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetAppSkeyTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+APPSKEY=OK\r\n" );
    EXPECT_TRUE( node.setAppSkey( kValidKey ) );
}

TEST_F( SetAppSkeyTest, ReturnsFalseForNullPtr )
{
    EXPECT_FALSE( node.setAppSkey( nullptr ) );
}

TEST_F( SetAppSkeyTest, DoesNotWriteForNullPtr )
{
    static_cast< void >( node.setAppSkey( nullptr ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

TEST_F( SetAppSkeyTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+APPSKEY=FAIL\r\n" );
    EXPECT_FALSE( node.setAppSkey( kValidKey ) );
}

TEST_F( SetAppSkeyTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setAppSkey( kValidKey ) );
}

TEST_F( SetAppSkeyTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setAppSkey( kValidKey ) );
}

TEST_F( SetAppSkeyTest, WrittenCmdContainsPrefix )
{
    givenAckResponse( "+APPSKEY=OK\r\n" );
    static_cast< void >( node.setAppSkey( kValidKey ) );
    EXPECT_NE( mock::hal::lwnode::allWriteString().find( "AT+APPSKEY=" ),
               std::string::npos );
}

TEST_F( SetAppSkeyTest, ReturnsFalseForWrongLengthKey )
{
    /* 31 chars */
    EXPECT_FALSE( node.setAppSkey( "2B7E151628AED2A6ABF7158809CF4F3" ) );
}

class SetDevAddrTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    static constexpr uint32_t kValidAddr { 0x26011D5BU };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetDevAddrTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+DEVADDR=OK\r\n" );
    EXPECT_TRUE( node.setDevAddr( kValidAddr ) );
}

TEST_F( SetDevAddrTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+DEVADDR=FAIL\r\n" );
    EXPECT_FALSE( node.setDevAddr( kValidAddr ) );
}

TEST_F( SetDevAddrTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setDevAddr( kValidAddr ) );
}

TEST_F( SetDevAddrTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setDevAddr( kValidAddr ) );
}

TEST_F( SetDevAddrTest, WrittenCmdContainsUppercaseHexAddr )
{
    givenAckResponse( "+DEVADDR=OK\r\n" );
    static_cast< void >( node.setDevAddr( kValidAddr ) );
    const std::string cmd { mock::hal::lwnode::allWriteString() };
    EXPECT_NE( cmd.find( "AT+DEVADDR=" ), std::string::npos );
    const auto pos { cmd.find( '=' ) };
    ASSERT_NE( pos, std::string::npos );
    const std::string addr { cmd.substr( pos + 1U, 8U ) };
    EXPECT_EQ( addr.size(), 8U );
    EXPECT_EQ( addr.find_first_of( "abcdef" ), std::string::npos );
}

class SetClassTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetClassTest, ReturnsTrueForClassA )
{
    givenAckResponse( "+CLASS=OK\r\n" );
    EXPECT_TRUE( node.setClass( Lwnode::DeviceClass::A ) );
}

TEST_F( SetClassTest, ReturnsTrueForClassC )
{
    givenAckResponse( "+CLASS=OK\r\n" );
    EXPECT_TRUE( node.setClass( Lwnode::DeviceClass::C ) );
}

TEST_F( SetClassTest, ReturnsFalseForInvalidClass )
{
    EXPECT_FALSE( node.setClass( static_cast< Lwnode::DeviceClass >( 0xFFU ) ) );
}

TEST_F( SetClassTest, DoesNotWriteForInvalidClass )
{
    static_cast< void >( node.setClass( static_cast< Lwnode::DeviceClass >( 0xFFU ) ) );
    EXPECT_EQ( mock::hal::lwnode::lastWriteLen(), 0U );
}

TEST_F( SetClassTest, WritesClassACommand )
{
    givenAckResponse( "+CLASS=OK\r\n" );
    static_cast< void >( node.setClass( Lwnode::DeviceClass::A ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+CLASS=CLASS_A" ),
               std::string::npos );
}

TEST_F( SetClassTest, WritesClassCCommand )
{
    givenAckResponse( "+CLASS=OK\r\n" );
    static_cast< void >( node.setClass( Lwnode::DeviceClass::C ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+CLASS=CLASS_C" ),
               std::string::npos );
}

TEST_F( SetClassTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+CLASS=FAIL\r\n" );
    EXPECT_FALSE( node.setClass( Lwnode::DeviceClass::A ) );
}

class SetDatarateTest : public ::testing::Test
{
protected:
    LwnodeHw hw {};
    Lwnode   node { hw };

    static constexpr uint8_t kValidRate { 3U };

    void TearDown() override { mock::hal::lwnode::reset(); }

    void givenAckResponse( const char * ack )
    {
        mock::hal::lwnode::setReadString( ack );
    }
};

TEST_F( SetDatarateTest, ReturnsTrueOnSuccess )
{
    givenAckResponse( "+DATARATE=OK\r\n" );
    EXPECT_TRUE( node.setDatarate( kValidRate ) );
}

TEST_F( SetDatarateTest, ReturnsFalseOnBadAck )
{
    givenAckResponse( "+DATARATE=FAIL\r\n" );
    EXPECT_FALSE( node.setDatarate( kValidRate ) );
}

TEST_F( SetDatarateTest, ReturnsFalseWhenWriteFails )
{
    mock::hal::lwnode::setWriteReturn( false );
    EXPECT_FALSE( node.setDatarate( kValidRate ) );
}

TEST_F( SetDatarateTest, ReturnsFalseWhenReadFails )
{
    mock::hal::lwnode::setReadReturn( false );
    EXPECT_FALSE( node.setDatarate( kValidRate ) );
}

TEST_F( SetDatarateTest, WrittenCmdContainsPrefix )
{
    givenAckResponse( "+DATARATE=OK\r\n" );
    static_cast< void >( node.setDatarate( kValidRate ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "AT+DATARATE=" ),
               std::string::npos );
}

TEST_F( SetDatarateTest, WrittenCmdContainsDatarateValue )
{
    givenAckResponse( "+DATARATE=OK\r\n" );
    static_cast< void >( node.setDatarate( kValidRate ) );
    EXPECT_NE( mock::hal::lwnode::lastWriteString().find( "3" ),
               std::string::npos );
}
