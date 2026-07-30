import { describe, expect, it } from "vitest";

import { insertAfterOnce, insertBeforeOnce, PatchError, replaceOnce } from "../src/core/text-edit.js";

describe("semantic text edits", () => {
  it("applies and then recognizes idempotent insertions", () => {
    const once = insertAfterOnce("a\nb\n", "a", "\nmarker", "marker", "file");
    expect(once).toBe("a\nmarker\nb\n");
    expect(insertAfterOnce(once, "a", "\nmarker", "marker", "file")).toBe(once);
  });

  it("supports before and replacement edits", () => {
    expect(insertBeforeOnce("a\nb", "b", "marker\n", "marker", "file")).toBe("a\nmarker\nb");
    expect(replaceOnce("a old b", "old", "new marker", "marker", "file")).toBe("a new marker b");
  });

  it("fails on missing or ambiguous anchors", () => {
    expect(() => insertAfterOnce("a", "b", "x", "x", "file")).toThrow(PatchError);
    expect(() => replaceOnce("a a", "a", "x", "x", "file")).toThrow(/ambiguous/);
  });
});
