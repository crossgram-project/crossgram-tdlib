import path from "node:path";
import { fileURLToPath } from "node:url";

import { readUtf8, writeUtf8IfChanged } from "./core/files.js";
import { insertAfterOnce, insertBeforeOnce, replaceOnce } from "./core/text-edit.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const featureRoot = path.join(repositoryRoot, "features", "server-switch", "files");

export interface PatchResult {
  changedFiles: string[];
}

async function editFile(
  root: string,
  relative: string,
  changedFiles: string[],
  edit: (source: string) => string,
): Promise<void> {
  const file = path.join(root, relative);
  const original = await readUtf8(file);
  const crlf = original.includes("\r\n");
  const normalized = original.replaceAll("\r\n", "\n");
  let updated = edit(normalized);
  if (crlf) updated = updated.replaceAll("\n", "\r\n");
  if (await writeUtf8IfChanged(file, updated)) changedFiles.push(relative);
}

async function installFile(
  root: string,
  sourceRelative: string,
  targetRelative: string,
  changedFiles: string[],
): Promise<void> {
  const content = await readUtf8(path.join(featureRoot, sourceRelative));
  if (await writeUtf8IfChanged(path.join(root, targetRelative), content)) {
    changedFiles.push(targetRelative);
  }
}

export async function patchTdlib(root: string): Promise<PatchResult> {
  const changedFiles: string[] = [];

  await installFile(
    root,
    "td/telegram/CrossgramServerConfig.h",
    "td/telegram/CrossgramServerConfig.h",
    changedFiles,
  );
  await installFile(
    root,
    "td/telegram/CrossgramServerConfig.cpp",
    "td/telegram/CrossgramServerConfig.cpp",
    changedFiles,
  );
  await installFile(
    root,
    "td/telegram/CrossgramDirectDownload.h",
    "td/telegram/CrossgramDirectDownload.h",
    changedFiles,
  );
  await installFile(
    root,
    "td/telegram/CrossgramDirectDownload.cpp",
    "td/telegram/CrossgramDirectDownload.cpp",
    changedFiles,
  );
  await installFile(
    root,
    "test/crossgram_server_config.cpp",
    "test/crossgram_server_config.cpp",
    changedFiles,
  );
  await installFile(
    root,
    "test/crossgram_direct_download.cpp",
    "test/crossgram_direct_download.cpp",
    changedFiles,
  );

  await editFile(root, "CMakeLists.txt", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      "  td/telegram/ConfigManager.cpp",
      "\n  td/telegram/CrossgramServerConfig.cpp",
      "td/telegram/CrossgramServerConfig.cpp",
      "CMakeLists.txt",
    );
    source = insertAfterOnce(
      source,
      "  td/telegram/CrossgramServerConfig.cpp",
      "\n  td/telegram/CrossgramDirectDownload.cpp",
      "td/telegram/CrossgramDirectDownload.cpp",
      "CMakeLists.txt",
    );
    source = insertAfterOnce(
      source,
      "  td/telegram/ConfigManager.h",
      "\n  td/telegram/CrossgramServerConfig.h",
      "td/telegram/CrossgramServerConfig.h",
      "CMakeLists.txt",
    );
    return insertAfterOnce(
      source,
      "  td/telegram/CrossgramServerConfig.h",
      "\n  td/telegram/CrossgramDirectDownload.h",
      "td/telegram/CrossgramDirectDownload.h",
      "CMakeLists.txt",
    );
  });

  await editFile(root, "test/CMakeLists.txt", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      "  ${CMAKE_CURRENT_SOURCE_DIR}/country_info.cpp",
      "\n  ${CMAKE_CURRENT_SOURCE_DIR}/crossgram_server_config.cpp",
      "crossgram_server_config.cpp",
      "test/CMakeLists.txt",
    );
    return insertAfterOnce(
      source,
      "  ${CMAKE_CURRENT_SOURCE_DIR}/crossgram_server_config.cpp",
      "\n  ${CMAKE_CURRENT_SOURCE_DIR}/crossgram_direct_download.cpp",
      "crossgram_direct_download.cpp",
      "test/CMakeLists.txt",
    );
  });

  await editFile(root, "td/generate/scheme/telegram_api.tl", changedFiles, (source) => insertAfterOnce(
    source,
    "upload.getFile#be5335be flags:# precise:flags.0?true cdn_supported:flags.1?true location:InputFileLocation offset:long limit:int = upload.File;",
    "\ncrossgram.getFileUrl#7520f6ea location:InputFileLocation = DataJSON;",
    "crossgram.getFileUrl#7520f6ea",
    "td/generate/scheme/telegram_api.tl",
  ));

  await editFile(root, "td/telegram/files/FileDownloader.h", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/DelayDispatcher.h"',
      '\n#include "td/net/Wget.h"',
      '#include "td/net/Wget.h"',
      "td/telegram/files/FileDownloader.h",
    );
    source = replaceOnce(
      source,
      "  enum class QueryType : uint8 { Default = 1, CDN, ReuploadCDN };",
      "  enum class QueryType : uint8 { Default = 1, CDN, ReuploadCDN, DirectUrl };",
      "ReuploadCDN, DirectUrl",
      "td/telegram/files/FileDownloader.h",
    );
    source = insertAfterOnce(
      source,
      "  bool only_check_{false};",
      `
  string crossgram_direct_url_;
  int64 crossgram_direct_url_expires_at_{0};
  bool crossgram_direct_disabled_{false};`,
      "crossgram_direct_url_expires_at_",
      "td/telegram/files/FileDownloader.h",
    );
    source = insertAfterOnce(
      source,
      "  std::map<uint64, std::pair<Part, ActorShared<>>> part_map_;",
      "\n  std::map<uint64, std::pair<Part, ActorOwn<Wget>>> crossgram_direct_part_map_;",
      "crossgram_direct_part_map_",
      "td/telegram/files/FileDownloader.h",
    );
    source = insertAfterOnce(
      source,
      "  Result<size_t> process_part(Part part, NetQueryPtr net_query) TD_WARN_UNUSED_RESULT;",
      `

  bool is_crossgram_direct_candidate() const;
  bool has_fresh_crossgram_direct_url();
  Status start_crossgram_direct_part(Part part) TD_WARN_UNUSED_RESULT;
  void on_crossgram_direct_part_result(uint64 unique_id, Result<unique_ptr<HttpQuery>> result);
  Result<size_t> process_crossgram_direct_part(Part part, const HttpQuery &query) TD_WARN_UNUSED_RESULT;
  Status finish_part(Part part, size_t size) TD_WARN_UNUSED_RESULT;`,
      "on_crossgram_direct_part_result",
      "td/telegram/files/FileDownloader.h",
    );
    return source;
  });

  await editFile(root, "td/telegram/files/FileDownloader.cpp", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/files/FileDownloader.h"',
      `

#include "td/telegram/CrossgramDirectDownload.h"
#include "td/telegram/CrossgramServerConfig.h"`,
      '#include "td/telegram/CrossgramDirectDownload.h"',
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      '#include "td/utils/misc.h"',
      '\n#include "td/utils/Promise.h"\n#include "td/utils/Time.h"',
      '#include "td/utils/Promise.h"',
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      `  if (!encryption_key.empty()) {
    CHECK(offset_ == 0);
  }
}`,
      `

bool FileDownloader::is_crossgram_direct_candidate() const {
  if (!CrossgramServerConfig::has_configuration() || remote_.is_web() || remote_.is_encrypted_any() ||
      !encryption_key_.empty() || !CrossgramDirectDownload::is_candidate(remote_.get_file_reference())) {
    return false;
  }
  auto location = remote_.as_input_file_location();
  if (location->get_id() == telegram_api::inputDocumentFileLocation::ID) {
    return true;
  }
  if (location->get_id() == telegram_api::inputPhotoFileLocation::ID) {
    const auto *photo = static_cast<const telegram_api::inputPhotoFileLocation *>(location.get());
    return photo->thumb_size_ != "m";
  }
  return false;
}

bool FileDownloader::has_fresh_crossgram_direct_url() {
  if (!is_crossgram_direct_candidate() || crossgram_direct_disabled_) {
    return false;
  }
  if (crossgram_direct_url_expires_at_ <= static_cast<int64>(Clocks::system() * 1000)) {
    crossgram_direct_url_.clear();
    crossgram_direct_url_expires_at_ = 0;
  }
  return !crossgram_direct_url_.empty();
}

Status FileDownloader::start_crossgram_direct_part(Part part) {
  callback_->on_start_download();
  auto unique_id = UniqueId::next();
  auto inserted = crossgram_direct_part_map_.emplace(unique_id, std::make_pair(part, ActorOwn<Wget>()));
  CHECK(inserted.second);
  auto promise = PromiseCreator::lambda(
      [actor_id = actor_id(this), unique_id](Result<unique_ptr<HttpQuery>> result) mutable {
        send_closure(actor_id, &FileDownloader::on_crossgram_direct_part_result, unique_id, std::move(result));
      });
  vector<std::pair<string, string>> headers;
  headers.emplace_back("Accept-Encoding", "identity");
  headers.emplace_back("Range", PSTRING() << "bytes=" << part.offset << '-' << part.offset + part.size - 1);
  inserted.first->second.second = create_actor<Wget>(
      "CrossgramDirectDownload", std::move(promise), crossgram_direct_url_, std::move(headers), 30);
  return Status::OK();
}

Result<size_t> FileDownloader::process_crossgram_direct_part(Part part, const HttpQuery &query) {
  auto bytes = BufferSlice(query.content_.str());
  if (!CrossgramDirectDownload::validate_range_response(
          query.code_, query.get_header("content-range"), part.offset, bytes.as_slice()) ||
      bytes.size() > part.size) {
    return Status::Error(400, "Invalid direct HTTP Range response");
  }
  TRY_STATUS(acquire_fd());
  TRY_RESULT(written, fd_.pwrite(bytes.as_slice(), part.offset));
  if (written != bytes.size()) {
    return Status::Error("Failed to save direct file part to the file");
  }
  return written;
}

void FileDownloader::on_crossgram_direct_part_result(uint64 unique_id, Result<unique_ptr<HttpQuery>> result) {
  auto it = crossgram_direct_part_map_.find(unique_id);
  if (it == crossgram_direct_part_map_.end() || stop_flag_) {
    return;
  }
  auto part = it->second.first;
  it->second.second.release();
  crossgram_direct_part_map_.erase(it);

  auto fallback = [this, part](Slice reason) {
    crossgram_direct_disabled_ = true;
    crossgram_direct_url_.clear();
    crossgram_direct_url_expires_at_ = 0;
    CrossgramDirectDownload::log_transport("relay", reason);
    resource_state_.stop_use(static_cast<int64>(part.size));
    parts_manager_.on_part_failed(part.id);
    update_estimated_limit();
    loop();
  };
  if (result.is_error()) {
    return fallback("http_error");
  }
  auto query = result.move_as_ok();
  auto r_size = process_crossgram_direct_part(part, *query);
  if (r_size.is_error() && r_size.error().code() == 400) {
    return fallback("http_range_failed");
  }
  if (r_size.is_error()) {
    return on_error(r_size.move_as_error());
  }
  auto status = finish_part(part, r_size.move_as_ok());
  if (status.is_error()) {
    return on_error(std::move(status));
  }
  update_estimated_limit();
  loop();
}`,
      "on_crossgram_direct_part_result",
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      "Result<bool> FileDownloader::should_restart_part(Part part, const NetQueryPtr &net_query) {",
      `
  if (narrow_cast<QueryType>(UniqueId::extract_key(net_query->id())) == QueryType::DirectUrl) {
    if (net_query->is_error()) {
      crossgram_direct_disabled_ = true;
      CrossgramDirectDownload::log_transport("relay", "url_rpc_failed");
      return true;
    }
    TRY_RESULT(result, fetch_result<telegram_api::crossgram_getFileUrl>(net_query->ok()));
    auto parsed = CrossgramDirectDownload::parse_resolved_url(
        result->data_, static_cast<int64>(Clocks::system() * 1000));
    if (parsed.is_error()) {
      crossgram_direct_disabled_ = true;
      CrossgramDirectDownload::log_transport("relay", "invalid_url_metadata");
    } else {
      crossgram_direct_url_ = std::move(parsed.ok().url);
      crossgram_direct_url_expires_at_ = parsed.ok().expires_at;
      CrossgramDirectDownload::log_transport("direct", "url_resolved");
    }
    return true;
  }`,
      "QueryType::DirectUrl) {",
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      `  NetQueryPtr net_query;
  if (!use_cdn_) {`,
      `
    if (is_crossgram_direct_candidate() && !crossgram_direct_disabled_) {
      auto unique_id = UniqueId::next(UniqueId::Type::Default, static_cast<uint8>(QueryType::DirectUrl));
      net_query = G()->net_query_creator().create(
          unique_id, nullptr, telegram_api::crossgram_getFileUrl(remote_.as_input_file_location()), {},
          remote_.get_dc_id(), net_query_type, NetQuery::AuthFlag::On);
      net_query->file_type_ = narrow_cast<int32>(remote_.file_type_);
      return std::move(net_query);
    }`,
      "UniqueId::Type::Default, static_cast<uint8>(QueryType::DirectUrl)",
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      `    for (auto &it : part_map_) {
      if (!it.second.second.empty() && !(begin_part_id <= it.second.first.id && it.second.first.id < end_part_id)) {
        VLOG(file_loader) << "Cancel part " << it.second.first.id;
        it.second.second.reset();  // cancel_query(it.second.second);
      }
    }`,
      `
    for (auto &it : crossgram_direct_part_map_) {
      if (!it.second.second.empty() && !(begin_part_id <= it.second.first.id && it.second.first.id < end_part_id)) {
        VLOG(file_loader) << "Cancel direct part " << it.second.first.id;
        it.second.second.reset();
      }
    }`,
      "Cancel direct part",
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertBeforeOnce(
      source,
      `    TRY_RESULT(query, start_part(part, parts_manager_.get_part_count(), parts_manager_.get_streaming_offset()));`,
      `    if (has_fresh_crossgram_direct_url()) {
      TRY_STATUS(start_crossgram_direct_part(part));
      continue;
    }
`,
      "start_crossgram_direct_part(part)",
      "td/telegram/files/FileDownloader.cpp",
    );
    source = insertAfterOnce(
      source,
      `void FileDownloader::tear_down() {
  for (auto &it : part_map_) {
    it.second.second.reset();  // cancel_query(it.second.second);
  }`,
      `
  for (auto &it : crossgram_direct_part_map_) {
    it.second.second.reset();
  }`,
      `void FileDownloader::tear_down() {
  for (auto &it : part_map_) {
    it.second.second.reset();  // cancel_query(it.second.second);
  }
  for (auto &it : crossgram_direct_part_map_)`,
      "td/telegram/files/FileDownloader.cpp",
    );
    return replaceOnce(
      source,
      `Status FileDownloader::try_on_part_query(Part part, NetQueryPtr query) {
  TRY_RESULT(size, process_part(part, std::move(query)));
  VLOG(file_loader) << "Ok part " << tag("id", part.id) << tag("size", part.size);
  resource_state_.stop_use(static_cast<int64>(part.size));
  auto old_ready_prefix_count = parts_manager_.get_unchecked_ready_prefix_count();
  TRY_STATUS(parts_manager_.on_part_ok(part.id, part.size, size));
  auto new_ready_prefix_count = parts_manager_.get_unchecked_ready_prefix_count();
  debug_total_parts_++;
  if (old_ready_prefix_count == new_ready_prefix_count) {
    debug_bad_parts_.push_back(part.id);
    debug_bad_part_order_++;
  }
  on_progress();
  return Status::OK();
}`,
      `Status FileDownloader::try_on_part_query(Part part, NetQueryPtr query) {
  TRY_RESULT(size, process_part(part, std::move(query)));
  return finish_part(part, size);
}

Status FileDownloader::finish_part(Part part, size_t size) {
  VLOG(file_loader) << "Ok part " << tag("id", part.id) << tag("size", part.size);
  resource_state_.stop_use(static_cast<int64>(part.size));
  auto old_ready_prefix_count = parts_manager_.get_unchecked_ready_prefix_count();
  TRY_STATUS(parts_manager_.on_part_ok(part.id, part.size, size));
  auto new_ready_prefix_count = parts_manager_.get_unchecked_ready_prefix_count();
  debug_total_parts_++;
  if (old_ready_prefix_count == new_ready_prefix_count) {
    debug_bad_parts_.push_back(part.id);
    debug_bad_part_order_++;
  }
  on_progress();
  return Status::OK();
}`,
      "Status FileDownloader::finish_part",
      "td/telegram/files/FileDownloader.cpp",
    );
  });

  await editFile(root, "td/telegram/OptionManager.cpp", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/ConfigManager.h"',
      '\n#include "td/telegram/CrossgramServerConfig.h"',
      '#include "td/telegram/CrossgramServerConfig.h"',
      "td/telegram/OptionManager.cpp",
    );
    return insertAfterOnce(
      source,
      "    case 'x': {",
      [
        "",
        "      if (name == CrossgramServerConfig::option_name()) {",
        "        if (is_td_inited_) {",
        "          return promise.set_error(400,",
        "                                   \"Crossgram server configuration must be set before TDLib parameters\");",
        "        }",
        "        if (value_constructor_id == td_api::optionValueEmpty::ID) {",
        "          set_option_empty(name);",
        "          return promise.set_value(Unit());",
        "        }",
        "        if (value_constructor_id != td_api::optionValueString::ID) {",
        "          return promise.set_error(400, \"Crossgram server configuration must have string value\");",
        "        }",
        "        const auto &configuration =",
        "            static_cast<const td_api::optionValueString *>(value.get())->value_;",
        "        auto parsed = CrossgramServerConfig::parse(configuration);",
        "        if (parsed.is_error()) {",
        "          return promise.set_error(400, parsed.error().public_message());",
        "        }",
        "        set_option_string(name, configuration);",
        "        return promise.set_value(Unit());",
        "      }",
      ].join("\n"),
      "Crossgram server configuration must be set before TDLib parameters",
      "td/telegram/OptionManager.cpp",
    );
  });

  await editFile(root, "td/telegram/net/PublicRsaKeySharedMain.cpp", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/net/PublicRsaKeySharedMain.h"',
      '\n\n#include "td/telegram/CrossgramServerConfig.h"',
      '#include "td/telegram/CrossgramServerConfig.h"',
      "td/telegram/net/PublicRsaKeySharedMain.cpp",
    );
    source = insertAfterOnce(
      source,
      '#include "td/utils/SliceBuilder.h"',
      '\n#include "td/utils/logging.h"',
      '#include "td/utils/logging.h"',
      "td/telegram/net/PublicRsaKeySharedMain.cpp",
    );
    return insertBeforeOnce(
      source,
      "  if (is_test) {",
      [
        "  if (CrossgramServerConfig::has_configuration()) {",
        "    auto parsed = CrossgramServerConfig::current();",
        "    if (parsed.is_error()) {",
        "      LOG(ERROR) << \"Refusing Telegram RSA fallback for invalid Crossgram configuration: \" << parsed.error();",
        "      return std::make_shared<PublicRsaKeySharedMain>(vector<RsaKey>());",
        "    }",
        "    vector<RsaKey> keys;",
        "    add_pem(keys, parsed.ok().rsa_key());",
        "    return std::make_shared<PublicRsaKeySharedMain>(std::move(keys));",
        "  }",
        "",
      ].join("\n"),
      "Refusing Telegram RSA fallback for invalid Crossgram configuration",
      "td/telegram/net/PublicRsaKeySharedMain.cpp",
    );
  });

  await editFile(root, "td/telegram/net/ConnectionCreator.cpp", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/ConfigManager.h"',
      '\n#include "td/telegram/CrossgramServerConfig.h"',
      '#include "td/telegram/CrossgramServerConfig.h"',
      "td/telegram/net/ConnectionCreator.cpp",
    );
    source = replaceOnce(
      source,
      "  dc_options_set_.add_dc_options(get_default_dc_options(G()->is_test_dc()));",
      [
        "  dc_options_set_.add_dc_options(get_default_dc_options(G()->is_test_dc()));",
        "  // A custom configuration is authoritative. Cached help.getConfig data",
        "  // may belong to Telegram or to a previously selected Crossgram server.",
        "  if (CrossgramServerConfig::has_configuration()) {",
        "    return;",
        "  }",
      ].join("\n"),
      "A custom configuration is authoritative.",
      "td/telegram/net/ConnectionCreator.cpp",
    );
    return insertAfterOnce(
      source,
      "  DcOptions res;",
      [
        "",
        "  if (CrossgramServerConfig::has_configuration()) {",
        "    auto parsed = CrossgramServerConfig::current();",
        "    if (parsed.is_error()) {",
        "      LOG(ERROR) << \"Refusing Telegram DC fallback for invalid Crossgram configuration: \" << parsed.error();",
        "      return res;",
        "    }",
        "    return parsed.ok().dc_options();",
        "  }",
      ].join("\n"),
      "Refusing Telegram DC fallback for invalid Crossgram configuration",
      "td/telegram/net/ConnectionCreator.cpp",
    );
  });

  await editFile(root, "td/telegram/ConfigManager.cpp", changedFiles, (source) => {
    source = insertAfterOnce(
      source,
      '#include "td/telegram/ConfigManager.h"',
      '\n\n#include "td/telegram/CrossgramServerConfig.h"',
      '#include "td/telegram/CrossgramServerConfig.h"',
      "td/telegram/ConfigManager.cpp",
    );
    source = replaceOnce(
      source,
      "    bool need_simple_config = has_connecting_problem && !is_valid_simple_config && simple_config_query_.empty();",
      "    bool need_simple_config = CrossgramServerConfig::allow_special_config() && has_connecting_problem &&\n" +
        "                              !is_valid_simple_config && simple_config_query_.empty();",
      "CrossgramServerConfig::allow_special_config()",
      "td/telegram/ConfigManager.cpp",
    );
    source = replaceOnce(
      source,
      "  send_closure(config_recoverer_, &ConfigRecoverer::on_dc_options_update, load_dc_options_update());",
      [
        "  auto initial_dc_options = load_dc_options_update();",
        "  if (CrossgramServerConfig::has_configuration()) {",
        "    auto parsed = CrossgramServerConfig::current();",
        "    initial_dc_options = parsed.is_ok() ? parsed.ok().dc_options() : DcOptions();",
        "  }",
        "  send_closure(config_recoverer_, &ConfigRecoverer::on_dc_options_update, std::move(initial_dc_options));",
      ].join("\n"),
      "auto initial_dc_options = load_dc_options_update();",
      "td/telegram/ConfigManager.cpp",
    );
    return insertAfterOnce(
      source,
      "void ConfigManager::on_dc_options_update(DcOptions dc_options) {",
      [
        "",
        "  if (CrossgramServerConfig::has_configuration()) {",
        "    auto parsed = CrossgramServerConfig::current();",
        "    dc_options = parsed.is_ok() ? parsed.ok().dc_options() : DcOptions();",
        "  }",
      ].join("\n"),
      "dc_options = parsed.is_ok() ? parsed.ok().dc_options() : DcOptions();",
      "td/telegram/ConfigManager.cpp",
    );
  });

  changedFiles.sort();
  return { changedFiles };
}
