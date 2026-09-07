import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateQuestion, mockQuestionCreate } = vi.hoisted(() => ({
  mockCreateQuestion: vi.fn(),
  mockQuestionCreate: vi.fn(),
}));

vi.mock("@/lib/domain/question-repository", () => ({
  createQuestion: mockCreateQuestion,
  listQuestions: vi.fn(),
  getQuestion: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    question: {
      create: mockQuestionCreate,
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
  mockCreateQuestion.mockReset();
  mockQuestionCreate.mockReset();
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
    expect(mockCreateQuestion).not.toHaveBeenCalled();
    expect(mockQuestionCreate).not.toHaveBeenCalled();
  });
});
