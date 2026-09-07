import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postPromoteDraft } from "@/app/api/drafts/[id]/promote/route";
import { POST as postQuestions } from "@/app/api/questions/route";
import { createQuestion } from "@/lib/domain/question-repository";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
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
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );

  return { mockPrisma };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

const originalDevKey = process.env.AGENT_API_KEY_DEV;

function publishableDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft_1",
    status: "DRAFT",
    type: "SINGLE_CHOICE",
    stemMd: "小车做匀加速直线运动，下列说法正确的是？",
    optionsJson: [
      { label: "A", value: "速度保持不变" },
      { label: "B", value: "速度随时间均匀增加" },
    ],
    answerJson: { type: "single", value: "B" },
    solutionMd: "由 $v = v_0 + at$ 可知速度随时间均匀变化。",
    difficulty: 2,
    knowledgePointIds: ["kp_motion"],
    tagIds: ["tag_image", "tag_example"],
    sourceRawAssetId: "raw_1",
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
    stemMd: "小车做匀加速直线运动，下列说法正确的是？",
    optionsJson: [
      { label: "A", value: "速度保持不变" },
      { label: "B", value: "速度随时间均匀增加" },
    ],
    answerJson: { type: "single", value: "B" },
    solutionMd: "由 $v = v_0 + at$ 可知速度随时间均匀变化。",
    difficulty: 2,
    sourceRawAssetId: "raw_1",
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

function promoteRequest(id = "draft_1") {
  return postPromoteDraft(
    editorSessionRequest(`http://localhost/api/drafts/${id}/promote`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.questionDraft.findUnique.mockResolvedValue(publishableDraft());
  mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.questionDraft.update.mockResolvedValue(
    publishableDraft({
      status: "PROMOTED",
      promotedAt: new Date("2026-09-07T01:00:00.000Z"),
      promotedQuestionId: "question_1",
    }),
  );
  mockPrisma.questionDraft.create.mockResolvedValue(publishableDraft());
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
  mockPrisma.rawAsset.findUnique.mockResolvedValue({
    id: "raw_1",
    status: "ARCHIVED",
  });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "user_owner",
    email: "owner@example.com",
  });
  mockPrisma.apiKey.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  vi.clearAllMocks();
});

describe("POST /api/drafts/:id/promote", () => {
  it("returns 400 答案必须匹配选项 and does not create a Question", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({
        answerJson: { type: "single", value: "C" },
        tagIds: null,
        sourceRawAssetId: null,
      }),
    );

    const response = await promoteRequest();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "答案必须匹配选项",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
    expect(mockPrisma.questionVersion.create).not.toHaveBeenCalled();
  });

  it("returns 409 when a concurrent promote already claimed the draft", async () => {
    mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 0 });

    const response = await promoteRequest();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Draft is not promotable",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("maps promotedQuestionId P2002 to 409 without a 500", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["promotedQuestionId"] },
      }),
    );

    const response = await promoteRequest();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Draft is not promotable",
    });
  });

  it("maps a unique conflict without a publicId target to 409", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: {},
      }),
    );

    const response = await promoteRequest();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Draft is not promotable",
    });
  });

  it("maps a tag foreign-key failure to 422 Tag not found", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.8.0",
        meta: {
          field_name: "tagId",
          constraint: "QuestionTag_tagId_fkey",
        },
      }),
    );

    const response = await promoteRequest();

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Tag not found",
    });
  });

  it("returns 403 Agent cannot publish questions for an agent bearer", async () => {
    const response = await postPromoteDraft(
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
    expect(mockPrisma.questionDraft.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("writes version, review record, promotedQuestionId, tags, and sourceRawAssetId", async () => {
    const response = await promoteRequest();

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      draft: {
        id: "draft_1",
        status: "PROMOTED",
        promotedQuestionId: "question_1",
        sourceRawAssetId: "raw_1",
      },
      question: {
        id: "question_1",
        status: "REVIEWED",
        sourceRawAssetId: "raw_1",
      },
    });

    expect(mockPrisma.question.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "REVIEWED",
        sourceRawAssetId: "raw_1",
        createdById: "user_owner",
        reviewedById: "user_owner",
        tags: {
          create: [{ tagId: "tag_image" }, { tagId: "tag_example" }],
        },
      }),
      include: expect.any(Object),
    });

    const versionData = mockPrisma.questionVersion.create.mock.calls[0]?.[0]
      ?.data as Record<string, unknown>;
    expect(versionData).toMatchObject({
      questionId: "question_1",
      version: 1,
      createdById: "user_owner",
    });
    expect(versionData).not.toHaveProperty("createdBy");

    expect(mockPrisma.reviewRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resourceType: "question_draft",
        resourceId: "draft_1",
        action: "promoted",
        actorId: "user_owner",
        diff: { questionId: "question_1" },
      }),
    });

    expect(mockPrisma.questionDraft.update).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: { promotedQuestionId: "question_1" },
    });
    expect(
      mockPrisma.questionDraft.update.mock.calls[0]?.[0]?.data,
    ).not.toHaveProperty("sourceRawAssetId");

    expect(mockPrisma.suggestion.updateMany).toHaveBeenCalledWith({
      where: { draftId: "draft_1", questionId: null },
      data: { questionId: "question_1" },
    });
    expect(mockPrisma.rawAsset.findUnique).toHaveBeenCalledWith({
      where: { id: "raw_1" },
      select: { id: true },
    });
    expect(mockPrisma.rawAsset.findUnique).toHaveBeenCalledTimes(1);
  });

  it("validates the post-claim re-read, not the outer existence snapshot", async () => {
    mockPrisma.questionDraft.findUnique
      .mockResolvedValueOnce(
        publishableDraft({
          answerJson: { type: "single", value: "C" },
        }),
      )
      .mockResolvedValueOnce(publishableDraft());

    const response = await promoteRequest();

    expect(response.status).toBe(201);
    expect(mockPrisma.question.create).toHaveBeenCalled();
  });

  it("returns 409 for an already promoted draft without the existing questionId", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({
        status: "PROMOTED",
        promotedQuestionId: "question_existing",
        promotedAt: new Date("2026-09-07T00:30:00.000Z"),
      }),
    );
    mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 0 });

    const response = await promoteRequest();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Draft is not promotable" });
    expect(body).not.toHaveProperty("questionId");
    expect(body).not.toHaveProperty("question");
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 409 for a rejected draft", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({ status: "REJECTED" }),
    );
    mockPrisma.questionDraft.updateMany.mockResolvedValue({ count: 0 });

    const response = await promoteRequest();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Draft is not promotable",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the draft has no knowledge points", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(
      publishableDraft({ knowledgePointIds: [] }),
    );

    const response = await promoteRequest();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("必须确认知识点"),
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 422 when a knowledge point is missing", async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValue([]);

    const response = await promoteRequest();

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Knowledge point not found",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 422 when the source raw asset is missing", async () => {
    mockPrisma.rawAsset.findUnique.mockResolvedValue(null);

    const response = await promoteRequest();

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the draft does not exist", async () => {
    mockPrisma.questionDraft.findUnique.mockResolvedValue(null);

    const response = await promoteRequest("missing_draft");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Draft not found",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("legacy createQuestion", () => {
  it("refuses to insert a REVIEWED question outside promote", async () => {
    await expect(
      createQuestion({
        type: "SINGLE_CHOICE",
        stemMd: "题干",
      }),
    ).rejects.toThrow("Official questions must be created by promoting a draft");
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});

describe("OQ-4a POST /api/questions", () => {
  it("creates a draft and promotes it in one transaction, including tags and source", async () => {
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => unknown) => {
        expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
        expect(mockPrisma.question.create).not.toHaveBeenCalled();
        const result = await callback(mockPrisma);
        expect(mockPrisma.questionDraft.create).toHaveBeenCalled();
        expect(mockPrisma.question.create).toHaveBeenCalled();
        return result;
      },
    );

    const response = await postQuestions(
      editorSessionRequest("http://localhost/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
          tagIds: ["tag_image", "tag_example"],
          sourceRawAssetId: "raw_1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      question: { id: "question_1", status: "REVIEWED" },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.questionDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        knowledgePointIds: ["kp_motion"],
        tagIds: ["tag_image", "tag_example"],
        sourceRawAssetId: "raw_1",
      }),
    });
    expect(mockPrisma.question.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceRawAssetId: "raw_1",
        tags: {
          create: [{ tagId: "tag_image" }, { tagId: "tag_example" }],
        },
      }),
      include: expect.any(Object),
    });
    expect(mockPrisma.questionVersion.create).toHaveBeenCalled();
    expect(mockPrisma.reviewRecord.create).toHaveBeenCalled();
  });

  it("still returns 403 for an agent bearer", async () => {
    const response = await postQuestions(
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
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
    expect(mockPrisma.question.create).not.toHaveBeenCalled();
  });
});
