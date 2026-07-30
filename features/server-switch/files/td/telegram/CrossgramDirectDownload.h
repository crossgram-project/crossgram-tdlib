//
// Crossgram TDLib direct media download helpers.
//
#pragma once

#include "td/utils/common.h"
#include "td/utils/Slice.h"
#include "td/utils/Status.h"

namespace td {

class CrossgramDirectDownload final {
 public:
  struct ResolvedUrl {
    string url;
    int64 expires_at{0};
  };

  static bool is_candidate(Slice file_reference);
  static Result<ResolvedUrl> parse_resolved_url(Slice json, int64 now);
  static bool validate_range_response(int32 status, Slice content_range, int64 offset, Slice bytes);
  static void log_transport(Slice transport, Slice reason);
};

}  // namespace td

