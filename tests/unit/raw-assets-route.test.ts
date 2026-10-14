/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

const { mockRawAssetFindUnique, mockReadLocalUpload } = vi.hoisted(() => ({
  mockRawAssetFindUnique: vi.fn(),
  mockReadLocalUpload: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    rawAsset: {
      create: vi.fn(),
      findUnique: mockRawAssetFindUnique,
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/storage/storage-service", () => ({
  readLocalUpload: mockReadLocalUpload,
  saveLocalUpload: vi.fn(),
}));

import { detectRawAssetKind } from "@/app/api/raw-assets/route";
import {
  assertSniffedKind,
  buildContentDisposition,
  parseRawAssetFormData,
  PASTED_TEXT_MAX_CHARS,
  RAW_ASSET_MAX_BYTES,
} from "@/lib/domain/raw-asset-upload";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";
import { signedPdfBytes, signedPngBytes } from "@/tests/unit/helpers/raw-asset-bytes";

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

  it("allows a PDF larger than the IMAGE 10MiB cap", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(signedPdfBytes(RAW_ASSET_MAX_BYTES.IMAGE + 1))], "notes.pdf", {
        type: "application/pdf",
      }),
    );

    await expect(parseRawAssetFormData(form)).resolves.toMatchObject({
      source: "file",
      file: { kind: "PDF", mimeType: "application/pdf" },
    });
  });

  it("rejects a PDF larger than 20MiB", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(RAW_ASSET_MAX_BYTES.PDF + 1)], "notes.pdf", {
        type: "application/pdf",
      }),
    );

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "File too large",
    });
  });

  it("rejects markdown larger than 1MiB", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File(
        [new Uint8Array(RAW_ASSET_MAX_BYTES.MARKDOWN + 1)],
        "stem.md",
        { type: "text/markdown" },
      ),
    );

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "File too large",
    });
  });

  it("rejects a plain-text file larger than 1MiB", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(RAW_ASSET_MAX_BYTES.TEXT + 1)], "notes.txt", {
        type: "text/plain",
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
      new File([new Uint8Array(signedPngBytes(RAW_ASSET_MAX_BYTES.IMAGE))], "vt.png", {
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

  it("maps a malformed multipart body to 400 Invalid request body", async () => {
    const { POST } = await import("@/app/api/raw-assets/route");

    const response = await POST(
      editorSessionRequest("http://localhost/api/raw-assets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{not-form-data",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
  });
});

describe("raw asset sniffing and disposition", () => {
  it("rejects an HTML body declared as PNG", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File(["<html><body>x</body></html>"], "vt.png", {
        type: "image/png",
      }),
    );

    await expect(parseRawAssetFormData(form)).rejects.toMatchObject({
      message: "Unsupported media type",
    });
  });

  it("rejects JPEG bytes declared as PNG via assertSniffedKind", () => {
    expect(() =>
      assertSniffedKind("image/png", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    ).toThrow("Unsupported media type");
  });

  it("encodes a Chinese filename with RFC 5987 filename*", () => {
    const header = buildContentDisposition("受力分析.png", true);

    expect(header).toContain('filename=".png"');
    expect(header).not.toMatch(/filename="[^"]*[\u4e00-\u9fff]/);
    expect(header).toContain("filename*=UTF-8''");
    expect(header).toContain(encodeURIComponent("受力分析.png"));
    expect(header.startsWith("inline;")).toBe(true);
  });

  it("percent-encodes RFC 5987 attr-char exclusions in filename*", () => {
    const header = buildContentDisposition("O'Brien (1)*.png", true);

    expect(header).toContain("filename*=UTF-8''O%27Brien%20%281%29%2A.png");
    expect(header).not.toMatch(/filename\*=UTF-8''[^;]*'/);
  });
});

describe("GET /api/raw-assets/:id/file", () => {
  it("serves bytes with nosniff and RFC 5987 disposition", async () => {
    mockRawAssetFindUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      originalName: "受力分析.png",
    });
    mockReadLocalUpload.mockResolvedValue(signedPngBytes());
    const { GET } = await import("@/app/api/raw-assets/[id]/file/route");

    const response = await GET(
      editorSessionRequest("http://localhost/api/raw-assets/raw_1/file"),
      { params: Promise.resolve({ id: "raw_1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Disposition")).toContain(
      "filename*=UTF-8''",
    );
    expect(response.headers.get("Content-Disposition")).not.toMatch(
      /filename="[^"]*[\u4e00-\u9fff]/,
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(signedPngBytes());
  });
});
