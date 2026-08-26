//
// Crossgram direct media download tests.
//
#include "td/telegram/CrossgramDirectDownload.h"

#include "td/utils/tests.h"

TEST(CrossgramDirectDownload, CandidateReferences) {
  ASSERT_TRUE(td::CrossgramDirectDownload::is_candidate("bridge-media:1"));
  ASSERT_TRUE(td::CrossgramDirectDownload::is_candidate("bridge-media:987654321"));
  ASSERT_TRUE(td::CrossgramDirectDownload::is_candidate("bridge-media:42:781234567890"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("bridge-media:0"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("bridge-media:01"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("bridge-media:42:01"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("bridge-media:42:781:extra"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("bridge-media:abc"));
  ASSERT_FALSE(td::CrossgramDirectDownload::is_candidate("telegram-media:1"));
}

TEST(CrossgramDirectDownload, ResolvedUrlMetadata) {
  auto parsed = td::CrossgramDirectDownload::parse_resolved_url(
      R"({"url":"https://cdn.example/media","expiresAt":2000,"supportsRange":true})", 1000);
  ASSERT_TRUE(parsed.is_ok());
  ASSERT_EQ(parsed.ok().url, "https://cdn.example/media");
  ASSERT_EQ(parsed.ok().expires_at, 2000);

  ASSERT_TRUE(td::CrossgramDirectDownload::parse_resolved_url(
                  R"({"url":"ftp://cdn.example/media","expiresAt":2000,"supportsRange":true})", 1000)
                  .is_error());
  ASSERT_TRUE(td::CrossgramDirectDownload::parse_resolved_url(
                  R"({"url":"https://cdn.example/media","expiresAt":999,"supportsRange":true})", 1000)
                  .is_error());
  ASSERT_TRUE(td::CrossgramDirectDownload::parse_resolved_url(
                  R"({"url":"https://cdn.example/media","expiresAt":2000,"supportsRange":false})", 1000)
                  .is_error());
}

TEST(CrossgramDirectDownload, RangeValidation) {
  ASSERT_TRUE(td::CrossgramDirectDownload::validate_range_response(206, "bytes 5-8/20", 5, "data"));
  ASSERT_TRUE(td::CrossgramDirectDownload::validate_range_response(206, "Bytes 0-2/3", 0, "abc"));
  ASSERT_FALSE(td::CrossgramDirectDownload::validate_range_response(200, "bytes 5-8/20", 5, "data"));
  ASSERT_FALSE(td::CrossgramDirectDownload::validate_range_response(206, "bytes 4-7/20", 5, "data"));
  ASSERT_FALSE(td::CrossgramDirectDownload::validate_range_response(206, "bytes 5-9/20", 5, "data"));
  ASSERT_FALSE(td::CrossgramDirectDownload::validate_range_response(206, "bytes 5-8/*", 5, "data"));
  ASSERT_FALSE(td::CrossgramDirectDownload::validate_range_response(206, "bytes 5-8/20", 5, ""));
}

