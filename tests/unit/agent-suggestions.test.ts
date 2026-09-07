import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAgentSuggestions } from "@/app/api/agent/suggestions/route";
import { devAgentScopes } from "@/lib/auth/agent-auth";

const { mockPrisma, mockReadAgentAuth } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    idempotencyRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    questionDraft: {
      findUnique: vi.fn(),
    },
    question: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    suggestion: {
      create: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );

  return {
    mockPrisma,
    mockReadAgentAuth: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth/agent-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/agent-auth")>();

  return {
    ...actual,
    readAgentAuth: mockReadAgentAuth,
  };
});

const originalDevKey = process.env.AGENT_API_KEY_DEV;

const metadataPayload = {
  knowledge_points: [
    {
      id: "kp_1",
      value: "v-t 图像面积表示位移",
      confidence: 0.86,
      reason: "题干出现 v-t 图像与位移",
    },
  ],
  difficulty: { value: 2, confidence: 0.72, reason: "概念应用，计算量低" },
  tag_ids: ["tag_1"],
  risks: [],
};

function agentAuth(scopes: readonly string[] = devAgentScopes) {
  return {
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...scopes],
  };
}

function agentRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/agent/suggestions", {
    method: "POST",
    headers: {
      Authorization: "Bearer dev-agent-key",
      "content-type": "application/json",
      "Idempotency-Key": "suggestion-key-1",
      "X-Request-Id": "req-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createdSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "suggestion_1",
    draftId: "draft_1",
    questionId: null,
    kind: "metadata",
    payload: metadataPayload,
    confidence: 0.86,
    status: "pending_review",
    createdByAgentRunId: "run_1",
    ...overrides,
  };
}

beforeEach(() => {
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  mockReadAgentAuth.mockResolvedValue(agentAuth());
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: "idem_1" });
  mockPrisma.idempotencyRecord.update.mockResolvedValue({});
  mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
  mockPrisma.questionDraft.findUnique.mockResolvedValue({
    id: "draft_1",
    status: "DRAFT",
    promotedQuestionId: null,
  });
  mockPrisma.question.findUnique.mockResolvedValue({ id: "question_1" });
  mockPrisma.question.update.mockResolvedValue({});
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
  mockPrisma.agentRun.update.mockResolvedValue({ id: "run_1" });
  mockPrisma.suggestion.create.mockResolvedValue(createdSuggestion());
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  vi.clearAllMocks();
});

describe("POST /api/agent/suggestions", () => {
  it("returns 401 without suggestions:create", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "suggestions:create")),
    );

    const response = await postAgentSuggestions(
      agentRequest({ draftId: "draft_1", payload: metadataPayload }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
    });
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
  });

  it("returns 400 when Idempotency-Key is missing", async () => {
    const response = await postAgentSuggestions(
      agentRequest(
        { draftId: "draft_1", payload: metadataPayload },
        { "Idempotency-Key": "" },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Idempotency-Key is required",
      request_id: "req-1",
    });
  });

  it("returns 400 when neither draftId nor questionId is provided", async () => {
    const response = await postAgentSuggestions(
      agentRequest({
        kind: "metadata",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Provide exactly one of draftId or questionId",
    });
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
  });

  it("returns 400 when both draftId and questionId are provided", async () => {
    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        questionId: "question_1",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Provide exactly one of draftId or questionId",
    });
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
    expect(mockPrisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it("treats null and blank XOR ids as omitted", async () => {
    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        questionId: null,
        kind: "metadata",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.questionDraft.findUnique).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      select: {
        id: true,
        status: true,
        promotedQuestionId: true,
      },
    });
    expect(mockPrisma.question.findUnique).not.toHaveBeenCalled();
  });

  it("creates a pending_review metadata suggestion without writing question.difficulty", async () => {
    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        kind: "metadata",
        confidence: 0.86,
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      suggestion: {
        id: "suggestion_1",
        status: "pending_review",
        kind: "metadata",
      },
    });
    expect(mockPrisma.suggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: "draft_1",
        questionId: null,
        kind: "metadata",
        status: "pending_review",
        createdByAgentRunId: "run_1",
        payload: metadataPayload,
      }),
    });
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: "dev-agent",
        toolName: "submit_suggestions",
        draftId: "draft_1",
        apiKeyId: null,
        requestId: "req-1",
      }),
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("attaches a promoted draft suggestion to promotedQuestionId", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "PROMOTED",
      promotedQuestionId: "question_9",
    });
    mockPrisma.question.findUnique.mockResolvedValue({ id: "question_9" });
    mockPrisma.suggestion.create.mockResolvedValue(
      createdSuggestion({
        questionId: "question_9",
      }),
    );

    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.suggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        draftId: "draft_1",
        questionId: "question_9",
        status: "pending_review",
      }),
    });
    expect(mockPrisma.question.findUnique).toHaveBeenCalledWith({
      where: { id: "question_9" },
      select: { id: true },
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns 409 when a promoted draft has no question", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "PROMOTED",
      promotedQuestionId: null,
    });

    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft is not updatable",
    });
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
    expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalled();
  });

  it("returns 409 for a rejected draft", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      status: "REJECTED",
      promotedQuestionId: null,
    });

    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "draft_1",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft is not updatable",
    });
  });

  it("returns 422 when the draft id is unknown", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(null);

    const response = await postAgentSuggestions(
      agentRequest({
        draftId: "missing_draft",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft not found",
    });
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
  });

  it("returns 422 when the question id is unknown", async () => {
    mockPrisma.question.findUnique.mockResolvedValue(null);

    const response = await postAgentSuggestions(
      agentRequest({
        questionId: "missing_question",
        payload: metadataPayload,
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Question not found",
    });
    expect(mockPrisma.questionDraft.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
  });
});
