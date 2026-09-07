import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    suggestion: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reviewRecord: {
      create: vi.fn(),
    },
    question: {
      update: vi.fn(),
    },
    questionDraft: {
      update: vi.fn(),
    },
    questionKnowledgePoint: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    questionTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    knowledgePoint: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

function patchRequest(body: unknown) {
  return editorSessionRequest("http://localhost/api/suggestions/suggestion_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const originalDevKey = process.env.AGENT_API_KEY_DEV;

describe("suggestion review route", () => {
  beforeEach(() => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";
    mockPrisma.suggestion.findUnique.mockReset();
    mockPrisma.suggestion.update.mockReset();
    mockPrisma.reviewRecord.create.mockReset();
    mockPrisma.question.update.mockReset();
    mockPrisma.questionDraft.update.mockReset();
    mockPrisma.questionKnowledgePoint.deleteMany.mockReset();
    mockPrisma.questionKnowledgePoint.createMany.mockReset();
    mockPrisma.questionTag.deleteMany.mockReset();
    mockPrisma.questionTag.createMany.mockReset();
    mockPrisma.knowledgePoint.findMany.mockReset();
    mockPrisma.tag.findMany.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma),
    );
    mockPrisma.knowledgePoint.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id })),
    );
    mockPrisma.tag.findMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id })),
    );
    mockPrisma.questionKnowledgePoint.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionKnowledgePoint.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.questionTag.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.question.update.mockResolvedValue({});
    mockPrisma.questionDraft.update.mockResolvedValue({});
  });

  it("rejects malformed JSON with a stable 400 JSON error", async () => {
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");

    const response = await PATCH(
      editorSessionRequest("http://localhost/api/suggestions/suggestion_1", {
        method: "PATCH",
        body: "{",
      }),
      {
        params: Promise.resolve({ id: "suggestion_1" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request body",
    });
    expect(mockPrisma.suggestion.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it.each([null, "accepted", ["accepted"]])(
    "rejects a non-object review body with a stable 400 JSON error",
    async (body) => {
      const { PATCH } = await import("@/app/api/suggestions/[id]/route");

      const response = await PATCH(patchRequest(body), {
        params: Promise.resolve({ id: "suggestion_1" }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid request body",
      });
      expect(mockPrisma.suggestion.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.question.update).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid review status with a stable 400 JSON error", async () => {
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");

    const response = await PATCH(patchRequest({ status: "approved" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid suggestion status",
    });
    expect(mockPrisma.suggestion.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns a stable 404 JSON error when the suggestion is missing", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");

    const response = await PATCH(patchRequest({ status: "rejected" }), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Suggestion not found",
    });
    expect(mockPrisma.suggestion.findUnique).toHaveBeenCalledWith({
      where: { id: "missing" },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
    expect(mockPrisma.reviewRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("updates suggestion status and creates a review record in one transaction", async () => {
    const existingSuggestion = {
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
    };
    const updatedSuggestion = {
      ...existingSuggestion,
      status: "accepted",
    };

    mockPrisma.suggestion.findUnique.mockResolvedValue(existingSuggestion);
    mockPrisma.suggestion.update.mockResolvedValue(updatedSuggestion);
    mockPrisma.reviewRecord.create.mockResolvedValue({
      id: "review_1",
      resourceType: "suggestion",
      resourceId: existingSuggestion.id,
      action: "accepted",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(
      patchRequest({ status: "accepted", notes: "Looks correct" }),
      {
        params: Promise.resolve({ id: existingSuggestion.id }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestion: updatedSuggestion,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.suggestion.update).toHaveBeenCalledWith({
      where: { id: existingSuggestion.id },
      data: { status: "accepted" },
    });
    expect(mockPrisma.reviewRecord.create).toHaveBeenCalledWith({
      data: {
        resourceType: "suggestion",
        resourceId: existingSuggestion.id,
        action: "accepted",
        notes: "Looks correct",
      },
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("accepts pending_review and omits empty review notes", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "rejected",
      kind: "metadata",
    });
    mockPrisma.suggestion.update.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      kind: "metadata",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "pending_review" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.reviewRecord.create).toHaveBeenCalledWith({
      data: {
        resourceType: "suggestion",
        resourceId: "suggestion_1",
        action: "pending_review",
        notes: undefined,
      },
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns a stable 500 JSON error when persistence fails", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      kind: "metadata",
    });
    mockPrisma.suggestion.update.mockRejectedValue(
      new Error("database password leaked"),
    );

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to review suggestion",
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns 403 for an agent PATCH and does not update the question", async () => {
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/suggestions/suggestion_1", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "accepted" }),
      }),
      {
        params: Promise.resolve({ id: "suggestion_1" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
    expect(mockPrisma.suggestion.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 422 and keeps pending_review when knowledge points lack id", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      draftId: null,
      kind: "metadata",
      payload: {
        knowledge_points: [
          {
            value: "v-t 图像面积表示位移",
            confidence: 0.86,
            reason: "题干出现速度-时间图像相关表述",
          },
        ],
        difficulty: { value: 2, confidence: 0.72, reason: "基础概念应用" },
        risks: ["请确认题干"],
      },
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Suggestion payload missing knowledge point id",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns 422 Knowledge point not found and rolls back", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      draftId: null,
      kind: "metadata",
      payload: {
        knowledge_points: [{ id: "missing_kp", value: "未知" }],
      },
    });
    mockPrisma.knowledgePoint.findMany.mockResolvedValue([]);

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Knowledge point not found",
    });
    expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns 422 Tag not found and rolls back", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      draftId: null,
      kind: "metadata",
      payload: {
        tag_ids: ["missing_tag"],
      },
    });
    mockPrisma.tag.findMany.mockResolvedValue([]);

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Tag not found",
    });
    expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
    expect(mockPrisma.questionTag.deleteMany).not.toHaveBeenCalled();
  });

  it("writes confirmed metadata on human accept and keeps risks on the payload", async () => {
    const existingSuggestion = {
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      draftId: "draft_1",
      kind: "metadata",
      payload: {
        knowledge_points: [
          { id: "kp_1", value: "v-t 图像面积表示位移", confidence: 0.86 },
        ],
        difficulty: { value: 2, confidence: 0.72, reason: "基础概念应用" },
        tag_ids: ["tag_1"],
        risks: ["请确认题干是否为“正确的是”"],
      },
    };
    mockPrisma.suggestion.findUnique.mockResolvedValue(existingSuggestion);
    mockPrisma.suggestion.update.mockResolvedValue({
      ...existingSuggestion,
      status: "accepted",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: existingSuggestion.id }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.questionKnowledgePoint.deleteMany).toHaveBeenCalledWith({
      where: { questionId: "question_1" },
    });
    expect(mockPrisma.questionKnowledgePoint.createMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: "question_1",
          knowledgePointId: "kp_1",
          role: "primary",
        },
      ],
    });
    expect(mockPrisma.question.update).toHaveBeenCalledWith({
      where: { id: "question_1" },
      data: {
        primaryKnowledgePointId: "kp_1",
        difficulty: 2,
      },
    });
    expect(mockPrisma.questionTag.deleteMany).toHaveBeenCalledWith({
      where: { questionId: "question_1" },
    });
    expect(mockPrisma.questionTag.createMany).toHaveBeenCalledWith({
      data: [{ questionId: "question_1", tagId: "tag_1" }],
    });
    expect(mockPrisma.questionDraft.update).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.update).toHaveBeenCalledWith({
      where: { id: existingSuggestion.id },
      data: { status: "accepted" },
    });
    expect(mockPrisma.question.update.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "metadata",
    );
    expect(mockPrisma.question.update.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "risks",
    );
  });

  it("replace-of-kind leaves a single primary knowledge point", async () => {
    const existingSuggestion = {
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      draftId: null,
      kind: "metadata",
      payload: {
        knowledge_points: [
          { id: "kp_new", value: "新主知识点" },
          { id: "kp_sec", value: "次知识点" },
        ],
      },
    };
    mockPrisma.suggestion.findUnique.mockResolvedValue(existingSuggestion);
    mockPrisma.suggestion.update.mockResolvedValue({
      ...existingSuggestion,
      status: "accepted",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: existingSuggestion.id }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.questionKnowledgePoint.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.questionKnowledgePoint.createMany).toHaveBeenCalledWith({
      data: [
        {
          questionId: "question_1",
          knowledgePointId: "kp_new",
          role: "primary",
        },
        {
          questionId: "question_1",
          knowledgePointId: "kp_sec",
          role: "secondary",
        },
      ],
    });
    expect(mockPrisma.question.update).toHaveBeenCalledWith({
      where: { id: "question_1" },
      data: {
        primaryKnowledgePointId: "kp_new",
      },
    });
    expect(mockPrisma.questionTag.deleteMany).not.toHaveBeenCalled();
  });

  it("repeats accept with 200 and replaces metadata again", async () => {
    const existingSuggestion = {
      id: "suggestion_1",
      status: "accepted",
      questionId: "question_1",
      draftId: null,
      kind: "metadata",
      payload: {
        knowledge_points: [{ id: "kp_1", value: "主知识点" }],
        difficulty: { value: 3 },
      },
    };
    mockPrisma.suggestion.findUnique.mockResolvedValue(existingSuggestion);
    mockPrisma.suggestion.update.mockResolvedValue(existingSuggestion);

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const first = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: existingSuggestion.id }),
    });
    const second = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: existingSuggestion.id }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockPrisma.questionKnowledgePoint.deleteMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.question.update).toHaveBeenCalledTimes(2);
  });

  it("leaves tags when tag_ids is omitted, clears on [], and replaces values", async () => {
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { difficulty: { value: 2 } },
    });
    mockPrisma.suggestion.update.mockResolvedValue({
      id: "suggestion_1",
      status: "accepted",
    });

    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.questionTag.deleteMany).not.toHaveBeenCalled();

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { tag_ids: [] },
    });
    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.questionTag.deleteMany).toHaveBeenCalledWith({
      where: { questionId: "question_1" },
    });
    expect(mockPrisma.questionTag.createMany).not.toHaveBeenCalled();

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { tag_ids: ["tag_a", "tag_b"] },
    });
    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.questionTag.createMany).toHaveBeenCalledWith({
      data: [
        { questionId: "question_1", tagId: "tag_a" },
        { questionId: "question_1", tagId: "tag_b" },
      ],
    });
  });

  it("leaves difficulty when omitted, clears on null, and writes a number", async () => {
    const { PATCH } = await import("@/app/api/suggestions/[id]/route");

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { tag_ids: ["tag_1"] },
    });
    mockPrisma.suggestion.update.mockResolvedValue({
      id: "suggestion_1",
      status: "accepted",
    });
    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { difficulty: null },
    });
    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.question.update).toHaveBeenCalledWith({
      where: { id: "question_1" },
      data: { difficulty: null },
    });

    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: { difficulty: { value: 4 } },
    });
    await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });
    expect(mockPrisma.question.update).toHaveBeenCalledWith({
      where: { id: "question_1" },
      data: { difficulty: 4 },
    });
  });

  it("writes draft json when the suggestion has no questionId", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: null,
      draftId: "draft_1",
      kind: "metadata",
      payload: {
        knowledge_points: [{ id: "kp_1", value: "主知识点" }],
        difficulty: { value: 2 },
        tag_ids: ["tag_1"],
      },
    });
    mockPrisma.suggestion.update.mockResolvedValue({
      id: "suggestion_1",
      status: "accepted",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "accepted" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.questionDraft.update).toHaveBeenCalledWith({
      where: { id: "draft_1" },
      data: {
        knowledgePointIds: ["kp_1"],
        difficulty: 2,
        tagIds: ["tag_1"],
      },
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
    expect(mockPrisma.questionKnowledgePoint.deleteMany).not.toHaveBeenCalled();
  });

  it("reject only updates status and a review record", async () => {
    mockPrisma.suggestion.findUnique.mockResolvedValue({
      id: "suggestion_1",
      status: "pending_review",
      questionId: "question_1",
      kind: "metadata",
      payload: {
        knowledge_points: [{ id: "kp_1", value: "主知识点" }],
        difficulty: { value: 2 },
      },
    });
    mockPrisma.suggestion.update.mockResolvedValue({
      id: "suggestion_1",
      status: "rejected",
    });

    const { PATCH } = await import("@/app/api/suggestions/[id]/route");
    const response = await PATCH(patchRequest({ status: "rejected" }), {
      params: Promise.resolve({ id: "suggestion_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
    expect(mockPrisma.questionKnowledgePoint.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.reviewRecord.create).toHaveBeenCalledWith({
      data: {
        resourceType: "suggestion",
        resourceId: "suggestion_1",
        action: "rejected",
        notes: undefined,
      },
    });
  });
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
});
