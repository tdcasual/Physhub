import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAgentKnowledgePoints } from "@/app/api/agent/knowledge-points/route";
import { POST as postAgentQualityCheck } from "@/app/api/agent/quality-check/route";
import { POST as postAgentQuestionSets } from "@/app/api/agent/question-sets/route";
import { POST as postAgentQuestionSetExport } from "@/app/api/agent/question-sets/[id]/export/route";
import { GET as getAgentTags } from "@/app/api/agent/tags/route";
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
    knowledgePoint: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    questionDraft: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    question: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    questionSet: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    exportJob: {
      create: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
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

function agentAuth(scopes: readonly string[] = devAgentScopes) {
  return {
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...scopes],
  };
}

function agentJsonRequest(url: string, body: unknown, init: RequestInit = {}) {
  return new Request(url, {
    method: "POST",
    ...init,
    headers: {
      Authorization: "Bearer dev-agent-key",
      "content-type": "application/json",
      "Idempotency-Key": "wrap-key-1",
      "X-Request-Id": "req-1",
      ...init.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const publishableQuestion = {
  type: "SINGLE_CHOICE",
  stemMd: "选择正确选项。",
  options: [
    { label: "A", value: "选项 A" },
    { label: "B", value: "选项 B" },
  ],
  answer: { type: "single", value: "B" },
  knowledgePointIds: ["kp_1"],
};

beforeEach(() => {
  mockReadAgentAuth.mockResolvedValue(agentAuth());
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: "idem_1" });
  mockPrisma.idempotencyRecord.update.mockResolvedValue({});
  mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
  mockPrisma.knowledgePoint.findMany.mockResolvedValue([
    {
      id: "kp_vt",
      name: "v-t 图像面积表示位移",
      slug: "vt-area-displacement",
      parentId: "kp_motion",
      sortOrder: 1,
    },
  ]);
  mockPrisma.tag.findMany.mockResolvedValue([
    { id: "tag_image", name: "有图", slug: "image-question", group: "media" },
  ]);
  mockPrisma.questionDraft.findUnique.mockResolvedValue(null);
  mockPrisma.questionSet.create.mockResolvedValue({
    id: "set_1",
    title: "练习卷",
    items: [{ questionId: "q1", sortOrder: 1 }],
  });
  mockPrisma.questionSet.findUnique.mockResolvedValue({
    id: "set_1",
    items: [
      {
        sortOrder: 1,
        question: {
          publicId: "q_motion_0001",
          stemMd: "速度为 $v$。",
          optionsJson: [{ label: "A", value: "$v$" }],
          answerJson: { type: "single", value: "A" },
          solutionMd: "解析",
        },
      },
    ],
  });
  mockPrisma.exportJob.create.mockResolvedValue({
    id: "export_1",
    status: "SUCCEEDED",
    format: "markdown",
    questionSetId: "set_1",
    outputKey: null,
  });
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/agent/knowledge-points", () => {
  it("returns 401 without questions:read", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await getAgentKnowledgePoints(
      new Request("http://localhost/api/agent/knowledge-points"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.knowledgePoint.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when questions:read is missing from the key", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["questions:search"]));

    const response = await getAgentKnowledgePoints(
      new Request("http://localhost/api/agent/knowledge-points", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.knowledgePoint.findMany).not.toHaveBeenCalled();
  });

  it("reuses listKnowledgePoints", async () => {
    const response = await getAgentKnowledgePoints(
      new Request("http://localhost/api/agent/knowledge-points", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      knowledgePoints: [
        {
          id: "kp_vt",
          name: "v-t 图像面积表示位移",
          slug: "vt-area-displacement",
          parentId: "kp_motion",
          sortOrder: 1,
        },
      ],
    });
  });
});

describe("GET /api/agent/tags", () => {
  it("returns 401 without questions:read", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await getAgentTags(
      new Request("http://localhost/api/agent/tags"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.tag.findMany).not.toHaveBeenCalled();
  });

  it("reuses listTags", async () => {
    const response = await getAgentTags(
      new Request("http://localhost/api/agent/tags", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tags: [
        { id: "tag_image", name: "有图", slug: "image-question", group: "media" },
      ],
    });
  });
});

describe("POST /api/agent/quality-check", () => {
  it("returns 401 without quality:check", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "quality:check")),
    );

    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {
        question: publishableQuestion,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
  });

  it("requires an Idempotency-Key", async () => {
    const response = await postAgentQualityCheck(
      new Request("http://localhost/api/agent/quality-check", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
          "X-Request-Id": "req-1",
        },
        body: JSON.stringify({ question: publishableQuestion }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Idempotency-Key is required",
    });
  });

  it("rejects both draftId and question", async () => {
    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {
        draftId: "draft_1",
        question: publishableQuestion,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Provide exactly one of draftId or question",
    });
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects an empty body", async () => {
    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {}),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Provide exactly one of draftId or question",
    });
  });

  it.each([null, ""])("treats %j question as omitted", async (question) => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue({
      id: "draft_1",
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项。",
      optionsJson: publishableQuestion.options,
      answerJson: publishableQuestion.answer,
      solutionMd: null,
      difficulty: 2,
      knowledgePointIds: ["kp_1"],
    });

    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {
        draftId: "draft_1",
        question,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      publishable: true,
      errors: [],
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.questionDraft.update).not.toHaveBeenCalled();
  });

  it("returns publishable false without writing a Question", async () => {
    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {
        question: { stemMd: "未完成的题干" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      publishable: false,
      errors: expect.arrayContaining(["必须确认知识点"]),
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "check_question_quality",
        status: "SUCCEEDED",
      }),
    });
  });

  it("returns 422 when draftId is unknown", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(null);

    const response = await postAgentQualityCheck(
      agentJsonRequest("http://localhost/api/agent/quality-check", {
        draftId: "missing",
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft not found",
    });
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/question-sets", () => {
  it("returns 401 without question_sets:create", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(
        devAgentScopes.filter((scope) => scope !== "question_sets:create"),
      ),
    );

    const response = await postAgentQuestionSets(
      agentJsonRequest("http://localhost/api/agent/question-sets", {
        title: "练习卷",
        questionIds: ["q1"],
      }),
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.questionSet.create).not.toHaveBeenCalled();
  });

  it("creates a question set with request_id", async () => {
    const response = await postAgentQuestionSets(
      agentJsonRequest("http://localhost/api/agent/question-sets", {
        title: "练习卷",
        questionIds: ["q1"],
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      questionSet: { id: "set_1", title: "练习卷" },
    });
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "create_question_set",
      }),
    });
  });
});

describe("POST /api/agent/question-sets/:id/export", () => {
  it("returns 401 without exports:create", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "exports:create")),
    );

    const response = await postAgentQuestionSetExport(
      agentJsonRequest(
        "http://localhost/api/agent/question-sets/set_1/export",
        {},
      ),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockPrisma.exportJob.create).not.toHaveBeenCalled();
  });

  it("keeps teacher default true and includes answers", async () => {
    const response = await postAgentQuestionSetExport(
      agentJsonRequest(
        "http://localhost/api/agent/question-sets/set_1/export",
        { format: "markdown" },
      ),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({
      request_id: "req-1",
      exportJob: { id: "export_1", status: "SUCCEEDED", format: "markdown" },
    });
    expect(json.content).toContain("答案：A");
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "export_question_set",
        input: expect.objectContaining({ teacher: true }),
      }),
    });
  });

  it("honors explicit teacher: false", async () => {
    const response = await postAgentQuestionSetExport(
      agentJsonRequest(
        "http://localhost/api/agent/question-sets/set_1/export",
        { format: "markdown", teacher: false },
      ),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.content).not.toContain("答案：A");
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        input: expect.objectContaining({ teacher: false }),
      }),
    });
  });

  it("returns 404 when the path id is missing", async () => {
    mockPrisma.questionSet.findUnique.mockResolvedValue(null);

    const response = await postAgentQuestionSetExport(
      agentJsonRequest(
        "http://localhost/api/agent/question-sets/missing/export",
        {},
      ),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "Question set not found",
    });
  });
});
