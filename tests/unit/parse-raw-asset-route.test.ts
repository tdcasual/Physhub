import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockParseRawAsset } = vi.hoisted(() => ({
  mockParseRawAsset: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/domain/parse-raw-asset-workflow", () => ({
  parseRawAsset: mockParseRawAsset,
}));

import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

describe("raw asset parse route", () => {
  const originalMockParse = process.env.ENABLE_MOCK_PARSE;

  beforeEach(() => {
    process.env.ENABLE_MOCK_PARSE = "true";
    mockParseRawAsset.mockReset();
  });

  afterEach(() => {
    if (originalMockParse === undefined) {
      delete process.env.ENABLE_MOCK_PARSE;
    } else {
      process.env.ENABLE_MOCK_PARSE = originalMockParse;
    }
  });

  it("returns 404 Not found and does not parse when ENABLE_MOCK_PARSE is off", async () => {
    delete process.env.ENABLE_MOCK_PARSE;
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(editorSessionRequest("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(mockParseRawAsset).not.toHaveBeenCalled();
  });

  it("returns a stable 404 JSON error when the raw asset is missing", async () => {
    mockParseRawAsset.mockResolvedValue({ status: "not_found" });
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(editorSessionRequest("http://localhost"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
  });

  it("returns the created draft when parsing succeeds", async () => {
    const draft = { id: "draft_1" };
    mockParseRawAsset.mockResolvedValue({ status: "created", draft });
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(editorSessionRequest("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ draft });
  });

  it("returns a stable 500 JSON error when parsing fails", async () => {
    mockParseRawAsset.mockResolvedValue({ status: "failed" });
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(editorSessionRequest("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to parse raw asset",
    });
  });

  it("returns a stable 500 JSON error when the workflow rejects", async () => {
    mockParseRawAsset.mockRejectedValue(new Error("database password leaked"));
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(editorSessionRequest("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to parse raw asset",
    });
  });
});
