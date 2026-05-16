import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetQuestion, mockSearchQuestions } = vi.hoisted(() => ({
  mockGetQuestion: vi.fn(),
  mockSearchQuestions: vi.fn(),
}));

vi.mock("@/lib/search/question-search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/search/question-search")>();

  return {
    ...actual,
    searchQuestions: mockSearchQuestions,
  };
});

vi.mock("@/lib/domain/question-repository", () => ({
  getQuestion: mockGetQuestion,
}));

const originalDevKey = process.env.AGENT_API_KEY_DEV;

function authorizedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: "Bearer dev-agent-key",
      ...init.headers,
    },
  });
}

beforeEach(() => {
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  mockGetQuestion.mockReset();
  mockSearchQuestions.mockReset();
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
});

describe("POST /api/agent/search-questions", () => {
  it("returns 401 without a questions:search bearer token", async () => {
    const { POST } = await import("@/app/api/agent/search-questions/route");

    const response = await POST(
      new Request("http://localhost/api/agent/search-questions", {
        method: "POST",
        body: JSON.stringify({ query: "找题" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockSearchQuestions).not.toHaveBeenCalled();
  });

  it("returns the reused searchQuestions result for an authorized request", async () => {
    mockSearchQuestions.mockResolvedValue({
      understanding: { rawQuery: "找题", terms: [], limit: 10 },
      results: [{ id: "question_1", question_id: "q_manual_0001" }],
    });
    const { POST } = await import("@/app/api/agent/search-questions/route");

    const response = await POST(
      authorizedRequest("http://localhost/api/agent/search-questions", {
        method: "POST",
        body: JSON.stringify({
          query: "找题",
          constraints: { status: ["PUBLISHED"], limit: 1 },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      understanding: { rawQuery: "找题", terms: [], limit: 10 },
      results: [{ id: "question_1", question_id: "q_manual_0001" }],
    });
    expect(mockSearchQuestions).toHaveBeenCalledWith("找题", {
      status: ["PUBLISHED"],
      limit: 1,
    });
  });

  it("returns stable 400 responses for invalid search bodies", async () => {
    const { POST } = await import("@/app/api/agent/search-questions/route");

    const response = await POST(
      authorizedRequest("http://localhost/api/agent/search-questions", {
        method: "POST",
        body: JSON.stringify({ query: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Search query is required",
    });
    expect(mockSearchQuestions).not.toHaveBeenCalled();
  });

  it("returns a stable 500 response for search failures", async () => {
    mockSearchQuestions.mockRejectedValue(new Error("database exploded"));
    const { POST } = await import("@/app/api/agent/search-questions/route");

    const response = await POST(
      authorizedRequest("http://localhost/api/agent/search-questions", {
        method: "POST",
        body: JSON.stringify({ query: "找题" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to search questions",
    });
  });
});

describe("GET /api/agent/questions/[id]", () => {
  it("returns 401 without a questions:read bearer token", async () => {
    const { GET } = await import("@/app/api/agent/questions/[id]/route");

    const response = await GET(
      new Request("http://localhost/api/agent/questions/question_1"),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockGetQuestion).not.toHaveBeenCalled();
  });

  it("returns the full question for an authorized read request", async () => {
    const question = {
      id: "question_1",
      stemMd: "题干",
      answerJson: { type: "single", value: "A" },
    };
    mockGetQuestion.mockResolvedValue(question);
    const { GET } = await import("@/app/api/agent/questions/[id]/route");

    const response = await GET(
      authorizedRequest("http://localhost/api/agent/questions/question_1"),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ question });
    expect(mockGetQuestion).toHaveBeenCalledWith("question_1");
  });

  it("returns 404 when the authorized question read misses", async () => {
    mockGetQuestion.mockResolvedValue(null);
    const { GET } = await import("@/app/api/agent/questions/[id]/route");

    const response = await GET(
      authorizedRequest("http://localhost/api/agent/questions/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Question not found",
    });
  });

  it("returns a stable 500 response for question read failures", async () => {
    mockGetQuestion.mockRejectedValue(new Error("database exploded"));
    const { GET } = await import("@/app/api/agent/questions/[id]/route");

    const response = await GET(
      authorizedRequest("http://localhost/api/agent/questions/question_1"),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load question",
    });
  });
});
