import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAgentDrafts } from "@/app/api/agent/question-drafts/route";
import {
  GET as getAgentDraft,
  PATCH as patchAgentDraft,
} from "@/app/api/agent/question-drafts/[id]/route";
import { GET as listHumanDrafts, POST as postHumanDrafts } from "@/app/api/drafts/route";
import {
  GET as getHumanDraft,
  PATCH as patchHumanDraft,
} from "@/app/api/drafts/[id]/route";
import { GET as getRawAssetFile } from "@/app/api/raw-assets/[id]/file/route";
import { devAgentScopes } from "@/lib/auth/agent-auth";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

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
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
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
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft_1",
    status: "DRAFT",
    type: null,
    stemMd: "未完成的题干",
    optionsJson: null,
    answerJson: null,
    solutionMd: null,
    difficulty: null,
    knowledgePointIds: null,
    tagIds: null,
    sourceRawAssetId: null,
    aiOutput: null,
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    promotedAt: null,
    promotedQuestionId: null,
    sourceRawAsset: null,
    suggestions: [],
    agentRuns: [],
    ...overrides,
  };
}

function agentAuth(scopes: readonly string[] = devAgentScopes) {
  return {
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...scopes],
  };
}

function agentRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: {
      Authorization: "Bearer dev-agent-key",
      "content-type": "application/json",
      "Idempotency-Key": "draft-key-1",
      "X-Request-Id": "req-1",
      ...init.headers,
    },
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
  mockPrisma.questionDraft.create.mockResolvedValue(draftRow());
  mockPrisma.questionDraft.update.mockResolvedValue(draftRow());
  mockPrisma.questionDraft.findUnique.mockResolvedValue(null);
  mockPrisma.questionDraft.findMany.mockResolvedValue([]);
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
  mockPrisma.knowledgePoint.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  mockPrisma.tag.findMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  mockPrisma.rawAsset.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  vi.clearAllMocks();
});

describe("POST /api/agent/question-drafts", () => {
  it("returns 401 without a drafts:create bearer token", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await postAgentDrafts(
      new Request("http://localhost/api/agent/question-drafts", {
        method: "POST",
        body: JSON.stringify({ stemMd: "未完成的题干" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
  });

  it("creates an incomplete draft with 201", async () => {
    const response = await postAgentDrafts(
      agentRequest("http://localhost/api/agent/question-drafts", {
        method: "POST",
        body: JSON.stringify({ stemMd: "未完成的题干" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      draft: {
        id: "draft_1",
        status: "DRAFT",
        stemMd: "未完成的题干",
      },
    });
    expect(mockPrisma.questionDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "DRAFT",
        stemMd: "未完成的题干",
      }),
    });
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: "dev-agent",
        toolName: "create_question_draft",
        draftId: "draft_1",
        apiKeyId: null,
        requestId: "req-1",
      }),
    });
    expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKeyId: "dev-agent",
        key: "draft-key-1",
        state: "in_progress",
      }),
    });
  });

  it("returns 422 for an unknown sourceRawAssetId", async () => {
    mockPrisma.rawAsset.findUnique.mockResolvedValue(null);

    const response = await postAgentDrafts(
      agentRequest("http://localhost/api/agent/question-drafts", {
        method: "POST",
        body: JSON.stringify({
          stemMd: "题干",
          sourceRawAssetId: "missing_raw",
        }),
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Raw asset not found",
      request_id: "req-1",
    });
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
    expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalled();
  });

  it("treats null and empty sourceRawAssetId as absent", async () => {
    const response = await postAgentDrafts(
      agentRequest("http://localhost/api/agent/question-drafts", {
        method: "POST",
        body: JSON.stringify({
          stemMd: "未完成的题干",
          sourceRawAssetId: null,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.rawAsset.findUnique).not.toHaveBeenCalled();
  });

  it("normalizes choice labels when options and answer are present", async () => {
    mockPrisma.questionDraft.create.mockResolvedValue(
      draftRow({
        type: "SINGLE_CHOICE",
        optionsJson: [{ label: "B", value: "匀加速后匀速" }],
        answerJson: { type: "single", value: "B" },
      }),
    );

    const response = await postAgentDrafts(
      agentRequest("http://localhost/api/agent/question-drafts", {
        method: "POST",
        body: JSON.stringify({
          type: "SINGLE_CHOICE",
          stemMd: "题干",
          options: [{ label: " b ", value: "匀加速后匀速" }],
          answer: { type: "single", value: " b " },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.questionDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        optionsJson: [{ label: "B", value: "匀加速后匀速" }],
        answerJson: { type: "single", value: "B" },
      }),
    });
  });
});

describe("PATCH /api/agent/question-drafts/:id", () => {
  it("returns 401 without a drafts:update bearer token", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "drafts:update")),
    );

    const response = await patchAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "NEEDS_REVIEW" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.questionDraft.update).not.toHaveBeenCalled();
  });

  it("rejects agent REJECTED with 400 Invalid draft status", async () => {
    const response = await patchAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid draft status",
    });
    expect(mockPrisma.questionDraft.findUnique).not.toHaveBeenCalled();
  });

  it("returns 200 no-op when status is already NEEDS_REVIEW", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      draftRow({ status: "NEEDS_REVIEW" }),
    );

    const response = await patchAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "NEEDS_REVIEW" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      draft: { id: "draft_1", status: "NEEDS_REVIEW" },
    });
    expect(mockPrisma.questionDraft.update).not.toHaveBeenCalled();
  });

  it("returns 409 when the draft is already promoted", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      draftRow({ status: "PROMOTED" }),
    );

    const response = await patchAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ stemMd: "改题干" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft is not updatable",
    });
  });
});

describe("GET /api/agent/question-drafts/:id", () => {
  it("returns 401 without drafts:read", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "drafts:read")),
    );

    const response = await getAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/draft_1", {
        method: "GET",
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.questionDraft.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the draft is missing", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(null);

    const response = await getAgentDraft(
      agentRequest("http://localhost/api/agent/question-drafts/missing", {
        method: "GET",
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Draft not found" });
  });

  it("returns the draft without requiring an Idempotency-Key", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(draftRow());

    const response = await getAgentDraft(
      new Request("http://localhost/api/agent/question-drafts/draft_1", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft_1", status: "DRAFT" },
    });
    expect(mockPrisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });
});

describe("human draft routes", () => {
  it("returns 403 when an agent bearer hits POST /api/drafts", async () => {
    const response = await postHumanDrafts(
      new Request("http://localhost/api/drafts", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ stemMd: "题干" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
  });

  it("lets a human reject a draft", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.questionDraft.findUnique.mockResolvedValue(draftRow());
    mockPrisma.questionDraft.update.mockResolvedValue(
      draftRow({ status: "REJECTED" }),
    );

    const response = await patchHumanDraft(
      editorSessionRequest("http://localhost/api/drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft_1", status: "REJECTED" },
    });
    expect(mockPrisma.questionDraft.update).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { status: "REJECTED" },
    });
  });

  it("lets a human send a NEEDS_REVIEW draft back to DRAFT", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      draftRow({ status: "NEEDS_REVIEW" }),
    );
    mockPrisma.questionDraft.update.mockResolvedValue(draftRow({ status: "DRAFT" }));

    const response = await patchHumanDraft(
      editorSessionRequest("http://localhost/api/drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "DRAFT" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.questionDraft.update).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { status: "DRAFT" },
    });
  });

  it("returns 200 no-op when a human repeats DRAFT status", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.questionDraft.findUnique.mockResolvedValue(draftRow());

    const response = await patchHumanDraft(
      editorSessionRequest("http://localhost/api/drafts/draft_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "DRAFT" }),
      }),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.questionDraft.update).not.toHaveBeenCalled();
  });

  it("lists drafts for an editor session", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.questionDraft.findMany.mockResolvedValue([draftRow()]);

    const response = await listHumanDrafts(
      editorSessionRequest("http://localhost/api/drafts"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      drafts: [{ id: "draft_1" }],
    });
  });

  it("creates a human draft", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await postHumanDrafts(
      editorSessionRequest("http://localhost/api/drafts", {
        method: "POST",
        body: JSON.stringify({ stemMd: "人工草稿" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft_1", stemMd: "未完成的题干" },
    });
  });

  it("returns a human draft by id", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.questionDraft.findUnique.mockResolvedValue(draftRow());

    const response = await getHumanDraft(
      editorSessionRequest("http://localhost/api/drafts/draft_1"),
      { params: Promise.resolve({ id: "draft_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: { id: "draft_1" },
    });
  });
});

describe("GET /api/raw-assets/:id/file", () => {
  it("returns 401 without an editor session", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await getRawAssetFile(
      new Request("http://localhost/api/raw-assets/raw_1/file"),
      { params: Promise.resolve({ id: "raw_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 for an agent bearer", async () => {
    const response = await getRawAssetFile(
      new Request("http://localhost/api/raw-assets/raw_1/file", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
      { params: Promise.resolve({ id: "raw_1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
  });

  it("returns 404 when the path id is missing", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.rawAsset.findUnique.mockResolvedValue(null);

    const response = await getRawAssetFile(
      editorSessionRequest("http://localhost/api/raw-assets/missing/file"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
  });

  it("does not treat a traversal storageKey as a readable path", async () => {
    mockReadAgentAuth.mockResolvedValue(null);
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "../etc/passwd",
      mimeType: "text/plain",
    });

    const response = await getRawAssetFile(
      editorSessionRequest("http://localhost/api/raw-assets/raw_1/file"),
      { params: Promise.resolve({ id: "raw_1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
  });
});
