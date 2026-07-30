import { copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { patchTdlib } from "../src/patch.js";

const sourceRoot = process.env.CROSSGRAM_TDLIB_SOURCE;
const inputs = [
  "CMakeLists.txt",
  "test/CMakeLists.txt",
  "td/telegram/OptionManager.cpp",
  "td/telegram/ConfigManager.cpp",
  "td/telegram/net/PublicRsaKeySharedMain.cpp",
  "td/telegram/net/ConnectionCreator.cpp",
];

describe("current TDLib source patch", () => {
  let root = "";

  beforeAll(async () => {
    if (!sourceRoot) throw new Error("CROSSGRAM_TDLIB_SOURCE must point to a TDLib checkout");
    root = await mkdtemp(path.join(os.tmpdir(), "crossgram-tdlib-e2e-"));
    for (const relative of inputs) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(sourceRoot, relative), target);
    }
  });

  afterAll(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("patches the real upstream anchors and is idempotent", async () => {
    const first = await patchTdlib(root);
    expect(first.changedFiles).toEqual([
      "CMakeLists.txt",
      "td/telegram/ConfigManager.cpp",
      "td/telegram/CrossgramServerConfig.cpp",
      "td/telegram/CrossgramServerConfig.h",
      "td/telegram/OptionManager.cpp",
      "td/telegram/net/ConnectionCreator.cpp",
      "td/telegram/net/PublicRsaKeySharedMain.cpp",
      "test/CMakeLists.txt",
      "test/crossgram_server_config.cpp",
    ]);
    expect((await patchTdlib(root)).changedFiles).toEqual([]);

    const optionManager = await readFile(path.join(root, "td/telegram/OptionManager.cpp"), "utf8");
    const connectionCreator = await readFile(
      path.join(root, "td/telegram/net/ConnectionCreator.cpp"),
      "utf8",
    );
    const rsa = await readFile(
      path.join(root, "td/telegram/net/PublicRsaKeySharedMain.cpp"),
      "utf8",
    );
    const configManager = await readFile(path.join(root, "td/telegram/ConfigManager.cpp"), "utf8");

    expect(optionManager).toContain("must be set before TDLib parameters");
    expect(connectionCreator).toContain("Refusing Telegram DC fallback");
    expect(rsa).toContain("Refusing Telegram RSA fallback");
    expect(configManager).toContain("CrossgramServerConfig::allow_special_config()");
  });
});
