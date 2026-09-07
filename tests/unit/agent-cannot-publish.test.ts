import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuestionCreate, mockDraftCreate, mockDraftUpdateMany } = vi.hoisted(
  () => ({
    mockQuestionCreate: vi.fn(),
    mockDraftCreate: vi.fn(),
    mockDraftUpdateMany: vi.fn(),
  }),
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    question: {
      create: mockQuestionCreate,
    },
    questionDraft: {
      create: mockDraftCreate,
      updateMany: mockDraftUpdateMany,
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

const originalDevKey = process.env.AGENT_API_KEY_DEV;

beforeEach(() => {
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  mockQuestionCreate.mockReset();
  mockDraftCreate.mockReset();
  mockDraftUpdateMany.mockReset();
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
});

describe("agent cannot publish questions", () => {
  it("returns 403 for Bearer POST /api/questions and does not create a question", async () => {
    const { POST } = await import("@/app/api/questions/route");

    const response = await POST(
      new Request("http://localhost/api/questions", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "SINGLE_CHOICE",
          stemMd: "题干",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent cannot publish questions",
    });
    expect(mockDraftCreate).not.toHaveBeenCalled();
    expect(mockDraftUpdateMany).not.toHaveBeenCalled();
    expect(mockQuestionCreate).not.toHaveBeenCalled();
  });

  it("does not import the legacy createQuestion insert from the questions route", () => {
    const source = readFileSync("app/api/questions/route.ts", "utf8");

    expect(source).not.toMatch(/\bcreateQuestion\b/);
  });
});
