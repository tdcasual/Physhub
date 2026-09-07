import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    question: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    questionVersion: {
      create: vi.fn(),
    },
    knowledgePoint: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    questionKnowledgePoint: {
      deleteMany: vi.fn(),
    },
    questionTag: {
      deleteMany: vi.fn(),
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

function existingQuestion() {
  return {
    id: "question_1",
    publicId: "q_motion_0001",
    type: "SINGLE_CHOICE",
    status: "REVIEWED",
    stemMd: "原题干",
    optionsJson: [
      { label: "A", value: "错" },
      { label: "B", value: "对" },
    ],
    answerJson: { type: "single", value: "B" },
    solutionMd: "解析",
    difficulty: 2,
    primaryKnowledgePointId: "kp_1",
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    knowledgePoints: [{ knowledgePointId: "kp_1" }],
    tags: [{ tagId: "tag_keep", tag: { id: "tag_keep", name: "keep" } }],
    versions: [{ version: 1 }],
  };
}

const publishableBody = {
  type: "SINGLE_CHOICE",
  stemMd: "改后的题干",
  options: [
    { label: "A", value: "错" },
    { label: "B", value: "对" },
  ],
  answer: { type: "single", value: "B" },
  solutionMd: "新解析",
  knowledgePointIds: ["kp_1"],
};

describe("PATCH /api/questions/[id]", () => {
  beforeEach(() => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";
    mockPrisma.question.findUnique.mockResolvedValue(existingQuestion());
    mockPrisma.knowledgePoint.findMany.mockResolvedValue([{ id: "kp_1" }]);
    mockPrisma.tag.findMany.mockResolvedValue([{ id: "tag_keep" }]);
    mockPrisma.question.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...existingQuestion(),
      ...args.data,
      stemMd: (args.data.stemMd as string) ?? existingQuestion().stemMd,
      status: (args.data.status as string) ?? existingQuestion().status,
      difficulty:
        args.data.difficulty === undefined
          ? existingQuestion().difficulty
          : (args.data.difficulty as number | null),
      knowledgePoints: [{ knowledgePointId: "kp_1" }],
      tags: existingQuestion().tags,
      versions: [{ version: 1 }],
    }));
    mockPrisma.questionVersion.create.mockResolvedValue({ id: "v2" });
  });

  afterEach(() => {
    process.env.AGENT_API_KEY_DEV = originalDevKey;
    vi.clearAllMocks();
  });

  it("writes QuestionVersion n+1 for a human content patch", async () => {
    const { PATCH } = await import("@/app/api/questions/[id]/route");
    const response = await PATCH(
      editorSessionRequest("http://localhost/api/questions/question_1", {
        method: "PATCH",
        body: JSON.stringify(publishableBody),
      }),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.version).toBe(2);
    expect(mockPrisma.questionVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          questionId: "question_1",
          version: 2,
        }),
      }),
    );
  });

  it("keeps existing tags and difficulty when a content PATCH omits those fields", async () => {
    const { PATCH } = await import("@/app/api/questions/[id]/route");
    const response = await PATCH(
      editorSessionRequest("http://localhost/api/questions/question_1", {
        method: "PATCH",
        body: JSON.stringify(publishableBody),
      }),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.questionTag.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          difficulty: 2,
        }),
      }),
    );
    const updateData = mockPrisma.question.update.mock.calls[0]?.[0]?.data as {
      tags?: unknown;
      difficulty: unknown;
    };
    expect(updateData.tags).toBeUndefined();
    expect(updateData.difficulty).toBe(2);
  });

  it("returns 403 when an agent tries to patch an official question", async () => {
    const { PATCH } = await import("@/app/api/questions/[id]/route");
    const response = await PATCH(
      new Request("http://localhost/api/questions/question_1", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify(publishableBody),
      }),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
    expect(mockPrisma.questionVersion.create).not.toHaveBeenCalled();
  });

  it("publishes REVIEWED to PUBLISHED", async () => {
    const { PATCH } = await import("@/app/api/questions/[id]/route");
    const response = await PATCH(
      editorSessionRequest("http://localhost/api/questions/question_1", {
        method: "PATCH",
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });
});
