import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readUtf8(file: string): Promise<string> {
  return readFile(file, "utf8");
}

export async function writeUtf8IfChanged(file: string, content: string): Promise<boolean> {
  let current: string | undefined;
  try {
    current = await readUtf8(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
  if (current === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return true;
}
