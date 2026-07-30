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
    "test/crossgram_server_config.cpp",
    "test/crossgram_server_config.cpp",
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
    return insertAfterOnce(
      source,
      "  td/telegram/ConfigManager.h",
      "\n  td/telegram/CrossgramServerConfig.h",
      "td/telegram/CrossgramServerConfig.h",
      "CMakeLists.txt",
    );
  });

  await editFile(root, "test/CMakeLists.txt", changedFiles, (source) => insertAfterOnce(
    source,
    "  ${CMAKE_CURRENT_SOURCE_DIR}/country_info.cpp",
    "\n  ${CMAKE_CURRENT_SOURCE_DIR}/crossgram_server_config.cpp",
    "crossgram_server_config.cpp",
    "test/CMakeLists.txt",
  ));

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
