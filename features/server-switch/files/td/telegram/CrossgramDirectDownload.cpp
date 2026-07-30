//
// Crossgram TDLib direct media download helpers.
//
#include "td/telegram/CrossgramDirectDownload.h"

#include "td/utils/HttpUrl.h"
#include "td/utils/JsonBuilder.h"
#include "td/utils/logging.h"
#include "td/utils/misc.h"
#include "td/utils/SliceBuilder.h"

namespace td {

bool CrossgramDirectDownload::is_candidate(Slice file_reference) {
  constexpr Slice prefix = "bridge-media:";
  if (!begins_with(file_reference, prefix)) {
    return false;
  }
  auto id = file_reference.substr(prefix.size());
  if (id.empty() || id[0] == '0') {
    return false;
  }
  for (auto c : id) {
    if (c < '0' || c > '9') {
      return false;
    }
  }
  return true;
}

Result<CrossgramDirectDownload::ResolvedUrl> CrossgramDirectDownload::parse_resolved_url(Slice json, int64 now) {
  auto mutable_json = json.str();
  TRY_RESULT(value, json_decode(mutable_json));
  if (value.type() != JsonValue::Type::Object) {
    return Status::Error(400, "Direct URL metadata must be a JSON object");
  }
  auto &object = value.get_object();
  TRY_RESULT(url, object.get_required_string_field("url"));
  TRY_RESULT(expires_at, object.get_required_long_field("expiresAt"));
  TRY_RESULT(supports_range, object.get_required_bool_field("supportsRange"));
  if (!supports_range) {
    return Status::Error(400, "Direct URL must support byte ranges");
  }
  TRY_RESULT(parsed_url, parse_url(url));
  if (parsed_url.protocol_ != HttpUrl::Protocol::Http && parsed_url.protocol_ != HttpUrl::Protocol::Https) {
    return Status::Error(400, "Direct URL must use HTTP or HTTPS");
  }
  if (expires_at <= now) {
    return Status::Error(400, "Direct URL is already expired");
  }
  return ResolvedUrl{std::move(url), expires_at};
}

bool CrossgramDirectDownload::validate_range_response(int32 status, Slice content_range, int64 offset, Slice bytes) {
  if (status != 206 || bytes.empty()) {
    return false;
  }
  auto normalized = to_lower(content_range);
  auto prefix = PSTRING() << "bytes " << offset << '-';
  if (!begins_with(normalized, prefix)) {
    return false;
  }
  auto rest = Slice(normalized).substr(prefix.size());
  auto slash = rest.find('/');
  if (slash == Slice::npos) {
    return false;
  }
  auto end = to_integer_safe<int64>(rest.substr(0, slash));
  auto total = to_integer_safe<int64>(rest.substr(slash + 1));
  return end.is_ok() && total.is_ok() && end.ok() == offset + static_cast<int64>(bytes.size()) - 1 &&
         total.ok() > end.ok();
}

void CrossgramDirectDownload::log_transport(Slice transport, Slice reason) {
  LOG(INFO) << "crossgram_download_transport=" << transport << " reason=" << reason;
}

}  // namespace td

