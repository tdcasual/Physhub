import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAgentPromoteDraft } from "@/app/api/agent/question-drafts/[id]/promote/route";
import { POST as postAgentQuestions } from "@/app/api/agent/questions/route";
import { POST as postHumanQuestions } from "@/app/api/questions/route";
import { POST as postHumanPromoteDraft } from "@/app/api/drafts/[id]/promote/route";
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
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    question: {
      create: vi.fn(),
    },
    questionVersion: {
      create: vi.fn(),
    },
    reviewRecord: {
      create: vi.fn(),
    },
    suggestion: {
      updateMany: vi.fn(),
    },
    knowledgePoint: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    rawAsset: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
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

const publishableBody = {
  type: "SINGLE_CHOICE",
  stemMd: "小车做匀加速直线运动，下列说法正确的是？",
  options: [
    { label: "A", value: "速度保持不变" },
    { label: "B", value: "速度随时间均匀增加" },
  ],
  answer: { type: "single", value: "B" },
  solutionMd: "由 $v = v_0 + at$ 可知速度随时间均匀变化。",
  difficulty: 2,
  knowledgePointIds: ["kp_motion"],
  tagIds: ["tag_image"],
};

function publishableDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft_1",
    status: "DRAFT",
    type: "SINGLE_CHOICE",
    stemMd: publishableBody.stemMd,
    optionsJson: publishableBody.options,
    answerJson: publishableBody.answer,
    solutionMd: publishableBody.solutionMd,
    difficulty: 2,
    knowledgePointIds: ["kp_motion"],
    tagIds: ["tag_image"],
    sourceRawAssetId: null,
    aiOutput: null,
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    promotedAt: null,
    promotedQuestionId: null,
    ...overrides,
  };
}

function createdQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "question_1",
    publicId: "q_manual_abc123def4_0001",
    type: "SINGLE_CHOICE",
    status: "REVIEWED",
    stemMd: publishableBody.stemMd,
    optionsJson: publishableBody.options,
    answerJson: publishableBody.answer,
    solutionMd: publishableBody.solutionMd,
    difficulty: 2,
    sourceRawAssetId: null,
    primaryKnowledgePointId: "kp_motion",
    createdById: "user_owner",
    reviewedById: "user_owner",
    createdAt: new Date("2026-09-07T01:00:00.000Z"),
    updatedAt: new Date("2026-09-07T01:00:00.000Z"),
    primaryKnowledgePoint: { id: "kp_motion", name: "运动学" },
    knowledgePoints: [],
    tags: [],
    ...overrides,
  };
}

function agentAuth(scopes: readonly string[] = devAgentScopes) {
  return {
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...scopes],
    createdById: null,
  };
}

function agentJsonRequest(url: string, body: unknown, init: RequestInit = {}) {
  return new Request(url, {
    method: "POST",
    ...init,
    headers: {
      Authorization: "Bearer dev-agent-key",
      "content-type": "application/json",
      "Idempotency-Key": "ingest-key-1",
      "X-Request-Id": "req-1",
      ...init.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  mockPrisma.questionDraft.create.mockResolvedValue(publishableDraft());
  mockPrisma.questionDraft.findUnique.mockResolvedValue(publishableDraft());
  mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.questionDraft.update.mockResolvedValue(
    publishableDraft({
      status: "PROMOTED",
      promotedAt: new Date("2026-09-07T01:00:00.000Z"),
      promotedQuestionId: "question_1",
    }),
  );
  mockPrisma.question.create.mockResolvedValue(createdQuestion());
  mockPrisma.questionVersion.create.mockResolvedValue({ id: "version_1" });
  mockPrisma.reviewRecord.create.mockResolvedValue({ id: "review_1" });
  mockPrisma.suggestion.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.knowledgePoint.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  mockPrisma.tag.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  mockPrisma.rawAsset.findUnique.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "user_owner",
    email: "owner@example.com",
  });
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  vi.clearAllMocks();
});

describe("POST /api/agent/questions", () => {
  it("creates a REVIEWED question through promote and records an agent run", async () => {
    const response = await postAgentQuestions(
      agentJsonRequest("http://localhost/api/agent/questions", publishableBody),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      question: { id: "question_1", status: "REVIEWED" },
      draft: { id: "draft_1", status: "PROMOTED", promotedQuestionId: "question_1" },
    });
    expect(mockPrisma.questionDraft.create).toHaveBeenCalled();
    expect(mockPrisma.question.create).toHaveBeenCalled();
    expect(mockPrisma.questionVersion.create).toHaveBeenCalled();
    expect(mockPrisma.reviewRecord.create).toHaveBeenCalled();
    expect(mockPrisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "user_owner",
        }),
      }),
    );
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "create_official_question",
        status: "SUCCEEDED",
        draftId: "draft_1",
        output: expect.objectContaining({
          questionId: "question_1",
          status: "REVIEWED",
        }),
      }),
    });
  });

  it("returns 400 必须确认知识点 and does not create a Question", async () => {
    const response = await postAgentQuestions(
      agentJsonRequest("http://localhost/api/agent/questions", {
        ...publishableBody,
        knowledgePointIds: [],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      request_id: "req-1",
      error: "必须确认知识点",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
  });

  it("returns 401 without questions:publish and does not write", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "questions:publish")),
    );

    const response = await postAgentQuestions(
      agentJsonRequest("http://localhost/api/agent/questions", publishableBody),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      request_id: "req-1",
      error: "Unauthorized",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it("returns 400 when Idempotency-Key is missing", async () => {
    const response = await postAgentQuestions(
      new Request("http://localhost/api/agent/questions", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
          "X-Request-Id": "req-1",
        },
        body: JSON.stringify(publishableBody),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      request_id: "req-1",
      error: "Idempotency-Key is required",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/question-drafts/:id/promote", () => {
  it("promotes an existing draft to REVIEWED", async () => {
    const response = await postAgentPromoteDraft(
      agentJsonRequest(
        "http://localhost/api/agent/question-drafts/draft_1/promote",
        {},
      ),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      question: { id: "question_1", status: "REVIEWED" },
      draft: { status: "PROMOTED", promotedQuestionId: "question_1" },
    });
    expect(mockPrisma.question.create).toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "promote_question_draft",
        draftId: "draft_1",
      }),
    });
  });

  it("forwards the API key creator as the question actor", async () => {
    mockReadAgentAuth.mockResolvedValue({
      apiKeyId: "api_key_1",
      name: "harness",
      scopes: [...devAgentScopes],
      createdById: "user_editor",
    });

    const response = await postAgentPromoteDraft(
      agentJsonRequest(
        "http://localhost/api/agent/question-drafts/draft_1/promote",
        {},
      ),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: "user_editor",
          reviewedById: "user_editor",
        }),
      }),
    );
  });

  it("returns 409 when the draft is already promoted", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({
        status: "PROMOTED",
        promotedQuestionId: "question_existing",
        promotedAt: new Date("2026-09-07T00:30:00.000Z"),
      }),
    );
    mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 0 });

    const response = await postAgentPromoteDraft(
      agentJsonRequest(
        "http://localhost/api/agent/question-drafts/draft_1/promote",
        {},
      ),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      request_id: "req-1",
      error: "Draft is not promotable",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 400 必须确认知识点 for an incomplete draft", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({ knowledgePointIds: [] }),
    );

    const response = await postAgentPromoteDraft(
      agentJsonRequest(
        "http://localhost/api/agent/question-drafts/draft_1/promote",
        {},
      ),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      request_id: "req-1",
      error: "必须确认知识点",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});

describe("human publish routes still refuse agent keys", () => {
  it("returns 403 for Bearer POST /api/questions", async () => {
    const response = await postHumanQuestions(
      new Request("http://localhost/api/questions", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify(publishableBody),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent cannot publish questions",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 403 for Bearer POST /api/drafts/:id/promote", async () => {
    const response = await postHumanPromoteDraft(
      new Request("http://localhost/api/drafts/draft_1/promote", {
        method: "POST",
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent cannot publish questions",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});
