#!/usr/bin/env node
import path from "node:path";

import { patchTdlib } from "./patch.js";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "patch") {
    throw new Error("Usage: crossgram-tdlib patch --source <tdlib-source>");
  }
  const source = option(args, "--source");
  if (!source) throw new Error("--source is required");
  const root = path.resolve(source);
  const result = await patchTdlib(root);
  if (result.changedFiles.length === 0) {
    process.stdout.write("TDLib source already contains the Crossgram patch.\n");
  } else {
    process.stdout.write(`Patched ${result.changedFiles.length} TDLib files:\n`);
    for (const file of result.changedFiles) process.stdout.write(`- ${file}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
