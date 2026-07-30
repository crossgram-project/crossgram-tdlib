#include "td/telegram/CrossgramServerConfig.h"

#include "td/utils/tests.h"

namespace td {
namespace {

const char *valid_config = R"json({
  "name": "Local Crossgram",
  "enable_special_config": false,
  "host": "127.0.0.1",
  "port": 4430,
  "rsa_key": "-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g\n5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO\n62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/\n+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9\nt6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs\n5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB\n-----END RSA PUBLIC KEY-----",
  "dcs": [{"id": 2, "ip": "127.0.0.2", "port": 8443}]
})json";

TEST(CrossgramServerConfig, ParsesAndFillsMissingDatacenters) {
  auto result = CrossgramServerConfig::parse(valid_config);
  ASSERT_TRUE(result.is_ok());
  auto config = result.move_as_ok();
  ASSERT_TRUE(config.is_enabled());
  ASSERT_FALSE(config.enable_special_config());
  ASSERT_EQ(config.name(), "Local Crossgram");
  ASSERT_EQ(config.dc_options().dc_options.size(), 5u);
  ASSERT_EQ(config.dc_options().dc_options[0].get_dc_id().get_raw_id(), 2);
  ASSERT_EQ(config.dc_options().dc_options[0].get_ip_address().get_port(), 8443);
}

TEST(CrossgramServerConfig, RejectsDuplicateDatacenters) {
  auto duplicate = string(valid_config);
  auto needle = string("{\"id\": 2, \"ip\": \"127.0.0.2\", \"port\": 8443}");
  auto replacement = needle + "," + needle;
  duplicate.replace(duplicate.find(needle), needle.size(), replacement);
  ASSERT_TRUE(CrossgramServerConfig::parse(duplicate).is_error());
}

TEST(CrossgramServerConfig, RejectsInvalidRsaKeyWithoutFallback) {
  auto invalid = string(valid_config);
  auto begin = invalid.find("-----BEGIN RSA PUBLIC KEY-----");
  auto end = invalid.find("-----END RSA PUBLIC KEY-----") + string("-----END RSA PUBLIC KEY-----").size();
  invalid.replace(begin, end - begin, "not-a-key");
  ASSERT_TRUE(CrossgramServerConfig::parse(invalid).is_error());
}

TEST(CrossgramServerConfig, RejectsHostnamesAndInvalidPorts) {
  auto invalid = string(valid_config);
  auto host = invalid.find("127.0.0.1");
  invalid.replace(host, string("127.0.0.1").size(), "example.com");
  ASSERT_TRUE(CrossgramServerConfig::parse(invalid).is_error());

  invalid = valid_config;
  auto port = invalid.find("4430");
  invalid.replace(port, string("4430").size(), "70000");
  ASSERT_TRUE(CrossgramServerConfig::parse(invalid).is_error());
}

}  // namespace
}  // namespace td
