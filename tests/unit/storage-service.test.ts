import { describe, expect, it } from "vitest";

import { buildStorageKey } from "@/lib/storage/storage-service";

describe("storage service", () => {
  it("builds safe storage keys", () => {
    expect(buildStorageKey("raw", "题目 1.png")).toMatch(
      /^raw\/\d+-[a-z0-9-]+\.png$/,
    );
  });

  it("falls back for filenames without extensions or safe base names", () => {
    expect(buildStorageKey("raw", "???")).toMatch(/^raw\/\d+-asset\.bin$/);
    expect(buildStorageKey("raw", "worksheet")).toMatch(
      /^raw\/\d+-worksheet\.bin$/,
    );
  });

  it("prevents path traversal in prefixes and original filenames", () => {
    const key = buildStorageKey("../raw\\incoming", "../../../题库 #1.PDF");

    expect(key).toMatch(/^raw\/incoming\/\d+-1\.pdf$/);
    expect(key).not.toContain("..");
    expect(key).not.toMatch(/^[\\/]/);
  });

  it("builds unique keys for repeated names", () => {
    const firstKey = buildStorageKey("raw", "image.png");
    const secondKey = buildStorageKey("raw", "image.png");

    expect(secondKey).not.toBe(firstKey);
  });

  it("rejects prefixes with no safe path segment", () => {
    expect(() => buildStorageKey("../..", "image.png")).toThrow(
      "storage key prefix must contain at least one safe segment",
    );
  });
});
