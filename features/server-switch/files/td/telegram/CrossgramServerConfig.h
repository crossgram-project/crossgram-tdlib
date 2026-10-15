//
// Crossgram TDLib server configuration.
//
#pragma once

#include "td/telegram/net/DcOptions.h"

#include "td/utils/common.h"
#include "td/utils/Slice.h"
#include "td/utils/Status.h"

namespace td {

class CrossgramServerConfig final {
 public:
  static constexpr Slice option_name() {
    return "x_crossgram_server_configuration";
  }

  static Result<CrossgramServerConfig> parse(Slice json);
  static Result<CrossgramServerConfig> current();

  // 单独检查是否存在自定义配置：若配置存在但解析失败，直接拒绝连接而非回退到官方生产环境
  static bool has_configuration();
  static bool allow_special_config();

  bool is_enabled() const {
    return enabled_;
  }
  bool enable_special_config() const {
    return enable_special_config_;
  }
  const string &id() const {
    return id_;
  }
  const string &name() const {
    return name_;
  }
  const string &rsa_key() const {
    return rsa_key_;
  }
  const DcOptions &dc_options() const {
    return dc_options_;
  }

 private:
  bool enabled_{false};
  bool enable_special_config_{true};
  string id_;
  string name_;
  string rsa_key_;
  DcOptions dc_options_;
};

}  // namespace td
