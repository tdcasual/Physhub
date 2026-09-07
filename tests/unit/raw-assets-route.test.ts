import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    rawAsset: {
      create: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
}));

import { detectRawAssetKind } from "@/app/api/raw-assets/route";
import {
  parseRawAssetFormData,
  PASTED_TEXT_MAX_CHARS,
  RAW_ASSET_MAX_BYTES,
} from "@/lib/domain/raw-asset-upload";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

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

describe("raw asset upload limits", () => {
  it("rejects an empty file.type before kind detection", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "vt.png"));

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "Unsupported media type",
    });
  });

  it("rejects image/svg+xml", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" }),
    );

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "Unsupported media type",
    });
  });

  it("rejects a PNG larger than 10MiB", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(RAW_ASSET_MAX_BYTES.IMAGE + 1)], "vt.png", {
        type: "image/png",
      }),
    );

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "File too large",
    });
  });

  it("rejects pasted text longer than 100_000 characters", async () => {
    const form = new FormData();
    form.append("text", "a".repeat(PASTED_TEXT_MAX_CHARS + 1));

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "Text too large",
    });
  });

  it("accepts a PNG at the 10MiB limit", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(RAW_ASSET_MAX_BYTES.IMAGE)], "vt.png", {
        type: "image/png",
      }),
    );

    await expect(parseRawAssetFormData(form)).resolves.toMatchObject({
      source: "file",
      file: { mimeType: "image/png", kind: "IMAGE" },
    });
  });
});

describe("POST /api/raw-assets", () => {
  it("rejects svg uploads with a stable 400", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" }),
    );
    const { POST } = await import("@/app/api/raw-assets/route");

    const response = await POST(
      editorSessionRequest("http://localhost/api/raw-assets", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unsupported media type",
    });
  });

  it("rejects a PNG larger than 10MiB with File too large", async () => {
    const boundary = "test-boundary";
    const header = Buffer.from(
      [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="vt.png"`,
        "Content-Type: image/png",
        "",
        "",
      ].join("\r\n"),
    );
    const body = Buffer.concat([
      header,
      Buffer.alloc(RAW_ASSET_MAX_BYTES.IMAGE + 1),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const { POST } = await import("@/app/api/raw-assets/route");

    const response = await POST(
      editorSessionRequest("http://localhost/api/raw-assets", {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        body: new Uint8Array(body),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "File too large",
    });
  });
});
