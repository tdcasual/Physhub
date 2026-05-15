import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockParseRawAsset } = vi.hoisted(() => ({
  mockParseRawAsset: vi.fn(),
}));

vi.mock("@/lib/domain/parse-raw-asset-workflow", () => ({
  parseRawAsset: mockParseRawAsset,
}));

describe("raw asset parse route", () => {
  beforeEach(() => {
    mockParseRawAsset.mockReset();
  });

  it("returns a stable 404 JSON error when the raw asset is missing", async () => {
    mockParseRawAsset.mockResolvedValue({ status: "not_found" });
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(new Request("http://localhost"), {
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

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ draft });
  });

  it("returns a stable 500 JSON error when parsing fails", async () => {
    mockParseRawAsset.mockResolvedValue({ status: "failed" });
    const { POST } = await import("@/app/api/raw-assets/[id]/parse/route");

    const response = await POST(new Request("http://localhost"), {
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

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to parse raw asset",
    });
  });
});
