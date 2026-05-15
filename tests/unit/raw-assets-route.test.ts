import { describe, expect, it } from "vitest";

import { detectRawAssetKind } from "@/app/api/raw-assets/route";

describe("raw asset upload route helpers", () => {
  it.each([
    ["application/pdf", "PDF"],
    ["image/png", "IMAGE"],
    ["image/jpeg", "IMAGE"],
    ["text/markdown", "MARKDOWN"],
    ["text/x-markdown", "MARKDOWN"],
    ["text/plain", "TEXT"],
    ["application/octet-stream", "TEXT"],
    ["", "TEXT"],
  ] as const)("detects %s as %s", (mimeType, expectedKind) => {
    expect(detectRawAssetKind(mimeType)).toBe(expectedKind);
  });
});
