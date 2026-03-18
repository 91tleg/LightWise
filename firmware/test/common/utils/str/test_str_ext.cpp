#include <gtest/gtest.h>

#include "utils/str_ext.h"
#include <cstring>

TEST(StrExtGetField, FirstMiddleLast)
{
    const uint8_t buf[] = "A,B,C";

    size_t start, len;

    EXPECT_TRUE(str_ext_get_field(buf, 5, 0, 0, &start, &len));
    EXPECT_EQ(start, 0U);
    EXPECT_EQ(len, 1U);

    EXPECT_TRUE(str_ext_get_field(buf, 5, 0, 1, &start, &len));
    EXPECT_EQ(start, 2U);
    EXPECT_EQ(len, 1U);

    EXPECT_TRUE(str_ext_get_field(buf, 5, 0, 2, &start, &len));
    EXPECT_EQ(start, 4U);
    EXPECT_EQ(len, 1U);
}

TEST(StrExtGetField, EmptyFields)
{
    const uint8_t buf[] = ",,A,";

    size_t start, len;

    EXPECT_TRUE(str_ext_get_field(buf, 4, 0, 0, &start, &len));
    EXPECT_EQ(len, 0U);

    EXPECT_TRUE(str_ext_get_field(buf, 4, 0, 1, &start, &len));
    EXPECT_EQ(len, 0U);

    EXPECT_TRUE(str_ext_get_field(buf, 4, 0, 2, &start, &len));
    EXPECT_EQ(len, 1U);

    EXPECT_TRUE(str_ext_get_field(buf, 4, 0, 3, &start, &len));
    EXPECT_EQ(len, 0U);
}

TEST(StrExtGetField, FieldIndexOutOfRange)
{
    const uint8_t buf[] = "A,B";
    size_t start, len;

    EXPECT_FALSE(str_ext_get_field(buf, 3, 0, 2, &start, &len));
}

TEST(StrExtGetField, InvalidArgs)
{
    const uint8_t buf[] = "A,B";
    size_t start, len;

    EXPECT_FALSE(str_ext_get_field(nullptr, 3, 0, 0, &start, &len));
    EXPECT_FALSE(str_ext_get_field(buf, 3, 3, 0, &start, &len));
    EXPECT_FALSE(str_ext_get_field(buf, 3, 0, 0, nullptr, &len));
}


TEST(StrExtParseX100, ValidNumbers)
{
    int32_t val;

    EXPECT_TRUE(str_ext_parse_x100((const uint8_t*)"0", 1, &val));
    EXPECT_EQ(val, 0);

    EXPECT_TRUE(str_ext_parse_x100((const uint8_t*)"1.23", 4, &val));
    EXPECT_EQ(val, 123);

    EXPECT_TRUE(str_ext_parse_x100((const uint8_t*)"1.2", 3, &val));
    EXPECT_EQ(val, 120);

    EXPECT_TRUE(str_ext_parse_x100((const uint8_t*)"-0.01", 5, &val));
    EXPECT_EQ(val, -1);
}

TEST(StrExtParseX100, ExtraFractionDigitsIgnored)
{
    int32_t val;
    EXPECT_TRUE(str_ext_parse_x100((const uint8_t*)"1.2345", 6, &val));
    EXPECT_EQ(val, 123);
}

TEST(StrExtParseX100, InvalidStrings)
{
    int32_t val;

    EXPECT_FALSE(str_ext_parse_x100((const uint8_t*)"", 0, &val));
    EXPECT_FALSE(str_ext_parse_x100((const uint8_t*)".", 1, &val));
    EXPECT_FALSE(str_ext_parse_x100((const uint8_t*)"-.", 2, &val));
    EXPECT_FALSE(str_ext_parse_x100((const uint8_t*)"1.", 2, &val));
    EXPECT_FALSE(str_ext_parse_x100((const uint8_t*)"1a", 2, &val));
}

TEST(StrExtParseX100, Overflow)
{
    int32_t val;
    EXPECT_FALSE(str_ext_parse_x100(
        (const uint8_t*)"21474837", 8, &val)); /* > INT32_MAX / 100 */
}


TEST(StrExtToUpperCase, Mixed)
{
    char s[] = "aBc123XyZ";
    str_ext_to_upper_case(s);
    EXPECT_STREQ(s, "ABC123XYZ");
}

TEST(StrExtToUpperCase, NullSafe)
{
    str_ext_to_upper_case(nullptr);
}


TEST(StrExtStartsWith, Basic)
{
    const uint8_t buf[] = "HELLO";

    EXPECT_TRUE(str_ext_starts_with(buf, 5, "HE", 2));
    EXPECT_FALSE(str_ext_starts_with(buf, 5, "HI", 2));
}

TEST(StrExtStartsWith, LengthEdgeCases)
{
    const uint8_t buf[] = "HI";

    EXPECT_FALSE(str_ext_starts_with(buf, 2, "HELLO", 5));
    EXPECT_FALSE(str_ext_starts_with(buf, 2, "H", 0));
}


TEST(StrExtStrnlen, Limits)
{
    EXPECT_EQ(str_ext_strnlen("ABC", 5), 3U);
    EXPECT_EQ(str_ext_strnlen("ABC", 2), 2U);
    EXPECT_EQ(str_ext_strnlen(nullptr, 5), 0U);
}


TEST(StrExtBufFindChar, FoundAndNotFound)
{
    const uint8_t buf[] = { 'A', 'B', 'C' };

    EXPECT_EQ(str_ext_buf_find_char(buf, 3, 'A'), 0);
    EXPECT_EQ(str_ext_buf_find_char(buf, 3, 'C'), 2);
    EXPECT_EQ(str_ext_buf_find_char(buf, 3, 'D'), -1);
}

TEST(StrExtBufFindChar, NullSafe)
{
    EXPECT_EQ(str_ext_buf_find_char(nullptr, 3, 'A'), -1);
}
