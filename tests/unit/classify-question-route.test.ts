import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    question: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
    },
    suggestion: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

describe("question classify route", () => {
  beforeEach(() => {
    mockPrisma.question.findUnique.mockReset();
    mockPrisma.question.update.mockReset();
    mockPrisma.agentRun.create.mockReset();
    mockPrisma.suggestion.create.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma),
    );
  });

  it("returns a stable 404 JSON error when the question is missing", async () => {
    mockPrisma.question.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/questions/[id]/classify/route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Question not found",
    });
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns a stable 500 JSON error when reading the question fails", async () => {
    mockPrisma.question.findUnique.mockRejectedValue(
      new Error("database password leaked"),
    );
    const { POST } = await import("@/app/api/questions/[id]/classify/route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "question_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to classify question",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
    expect(mockPrisma.suggestion.create).not.toHaveBeenCalled();
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("creates an agent run and metadata suggestion without mutating the question", async () => {
    const question = {
      id: "question_1",
      stemMd: "速度-时间图像的面积表示什么？",
      metadata: { confirmed: true },
      difficulty: 5,
      primaryKnowledgePointId: "kp_existing",
    };
    const agentRun = { id: "agent_run_1" };
    const suggestion = {
      id: "suggestion_1",
      questionId: question.id,
      kind: "metadata",
      createdByAgentRunId: agentRun.id,
    };

    mockPrisma.question.findUnique.mockResolvedValue(question);
    mockPrisma.agentRun.create.mockResolvedValue(agentRun);
    mockPrisma.suggestion.create.mockResolvedValue(suggestion);

    const { POST } = await import("@/app/api/questions/[id]/classify/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: question.id }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ suggestion });
    expect(mockPrisma.question.findUnique).toHaveBeenCalledWith({
      where: { id: question.id },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: "mock-classification-agent",
        toolName: "classify_question",
        input: { questionId: question.id, stemMd: question.stemMd },
        confidence: 0.86,
      }),
    });
    expect(mockPrisma.agentRun.create.mock.calls[0]?.[0].data.output).toEqual(
      expect.objectContaining({
        knowledge_points: [
          expect.objectContaining({
            value: expect.stringContaining("v-t"),
            confidence: 0.86,
          }),
        ],
        difficulty: expect.objectContaining({
          value: 2,
          confidence: 0.72,
        }),
      }),
    );
    expect(mockPrisma.suggestion.create).toHaveBeenCalledWith({
      data: {
        questionId: question.id,
        kind: "metadata",
        payload: mockPrisma.agentRun.create.mock.calls[0]?.[0].data.output,
        confidence: 0.86,
        createdByAgentRunId: agentRun.id,
      },
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("uses a transaction so suggestion failures cannot leave a committed agent run", async () => {
    const question = {
      id: "question_1",
      stemMd: "速度-时间图像",
    };
    const agentRun = { id: "agent_run_1" };

    mockPrisma.question.findUnique.mockResolvedValue(question);
    mockPrisma.agentRun.create.mockResolvedValue(agentRun);
    mockPrisma.suggestion.create.mockRejectedValue(
      new Error("suggestion insert failed"),
    );

    const { POST } = await import("@/app/api/questions/[id]/classify/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: question.id }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to classify question",
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.agentRun.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.suggestion.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });

  it("returns a stable 500 JSON error when classification persistence fails", async () => {
    mockPrisma.question.findUnique.mockResolvedValue({
      id: "question_1",
      stemMd: "速度-时间图像",
    });
    mockPrisma.agentRun.create.mockRejectedValue(
      new Error("database password leaked"),
    );
    const { POST } = await import("@/app/api/questions/[id]/classify/route");

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "question_1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to classify question",
    });
    expect(mockPrisma.question.update).not.toHaveBeenCalled();
  });
});
