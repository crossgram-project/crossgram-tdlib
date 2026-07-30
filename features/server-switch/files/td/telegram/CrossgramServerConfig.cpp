//
// Crossgram TDLib server configuration.
//
#include "td/telegram/CrossgramServerConfig.h"

#include "td/telegram/Global.h"

#include "td/mtproto/RSA.h"

#include "td/utils/JsonBuilder.h"
#include "td/utils/logging.h"
#include "td/utils/misc.h"
#include "td/utils/port/IPAddress.h"
#include "td/utils/SliceBuilder.h"

#include <set>

namespace td {
namespace {

Status validate_port(int32 port, Slice field) {
  if (port < 1 || port > 65535) {
    return Status::Error(400, PSLICE() << field << " must be an integer between 1 and 65535");
  }
  return Status::OK();
}

Result<IPAddress> parse_address(Slice value, int32 port, Slice field) {
  if (value.empty()) {
    return Status::Error(400, PSLICE() << field << " must be a non-empty IP address");
  }
  TRY_STATUS(validate_port(port, field));
  TRY_RESULT(address, IPAddress::get_ip_address(value));
  address.set_port(port);
  return address;
}

}  // namespace

Result<CrossgramServerConfig> CrossgramServerConfig::parse(Slice json) {
  if (json.empty()) {
    return Status::Error(400, "Crossgram server configuration must not be empty");
  }
  auto mutable_json = json.str();
  TRY_RESULT(value, json_decode(mutable_json));
  if (value.type() != JsonValue::Type::Object) {
    return Status::Error(400, "Crossgram server configuration must be a JSON object");
  }

  auto &object = value.get_object();
  CrossgramServerConfig result;
  result.enabled_ = true;
  TRY_RESULT(result.id_, object.get_optional_string_field("id"));
  TRY_RESULT(result.name_, object.get_required_string_field("name"));
  result.id_ = trim(std::move(result.id_));
  result.name_ = trim(std::move(result.name_));
  if (result.name_.empty()) {
    return Status::Error(400, "name must be a non-empty string");
  }
  if (result.id_.empty()) {
    result.id_ = result.name_;
  }

  TRY_RESULT(result.enable_special_config_, object.get_optional_bool_field("enable_special_config", true));
  TRY_RESULT(host, object.get_required_string_field("host"));
  TRY_RESULT(port, object.get_required_int_field("port"));
  host = trim(std::move(host));
  TRY_RESULT(default_address, parse_address(host, port, "host/port"));

  TRY_RESULT(result.rsa_key_, object.get_required_string_field("rsa_key"));
  result.rsa_key_ = trim(std::move(result.rsa_key_));
  auto rsa = mtproto::RSA::from_pem_public_key(result.rsa_key_);
  if (rsa.is_error()) {
    return Status::Error(400, PSLICE() << "rsa_key is not a valid RSA public key: " << rsa.error().message());
  }

  std::set<int32> ids;
  if (object.has_field("dcs")) {
    TRY_RESULT(dcs_value, object.extract_required_field("dcs", JsonValue::Type::Array));
    for (auto &item : dcs_value.get_array()) {
      if (item.type() != JsonValue::Type::Object) {
        return Status::Error(400, "Every dcs entry must be an object");
      }
      auto &dc = item.get_object();
      TRY_RESULT(dc_id, dc.get_required_int_field("id"));
      if (dc_id < 1 || dc_id > 1000 || !ids.insert(dc_id).second) {
        return Status::Error(400, "DC ids must be unique integers from 1 to 1000");
      }
      TRY_RESULT(ip, dc.get_required_string_field("ip"));
      TRY_RESULT(dc_port, dc.get_required_int_field("port"));
      ip = trim(std::move(ip));
      TRY_RESULT(address, parse_address(ip, dc_port, "dcs ip/port"));
      result.dc_options_.dc_options.emplace_back(DcId::internal(dc_id), address);
    }
  }

  for (int32 dc_id = 1; dc_id <= 5; dc_id++) {
    if (ids.insert(dc_id).second) {
      result.dc_options_.dc_options.emplace_back(DcId::internal(dc_id), default_address);
    }
  }
  return result;
}

Result<CrossgramServerConfig> CrossgramServerConfig::current() {
  if (!has_configuration()) {
    return CrossgramServerConfig();
  }
  return parse(G()->get_option_string(option_name()));
}

bool CrossgramServerConfig::has_configuration() {
  return G()->have_option(option_name()) && !G()->get_option_string(option_name()).empty();
}

bool CrossgramServerConfig::allow_special_config() {
  if (!has_configuration()) {
    return true;
  }
  auto config = current();
  if (config.is_error()) {
    LOG(ERROR) << "Invalid persisted Crossgram server configuration: " << config.error();
    return false;
  }
  return config.ok().enable_special_config();
}

}  // namespace td
