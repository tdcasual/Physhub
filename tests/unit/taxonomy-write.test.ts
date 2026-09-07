import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    knowledgePoint: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    questionKnowledgePoint: {
      count: vi.fn(),
    },
    questionTag: {
      count: vi.fn(),
    },
    question: {
      count: vi.fn(),
    },
    suggestion: {
      count: vi.fn(),
    },
    questionDraft: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

describe("taxonomy write routes", () => {
  beforeEach(() => {
    mockPrisma.knowledgePoint.findUnique.mockResolvedValue({ id: "kp_1" });
    mockPrisma.tag.findUnique.mockResolvedValue({ id: "tag_1" });
    mockPrisma.questionKnowledgePoint.count.mockResolvedValue(0);
    mockPrisma.questionTag.count.mockResolvedValue(0);
    mockPrisma.question.count.mockResolvedValue(0);
    mockPrisma.suggestion.count.mockResolvedValue(0);
    mockPrisma.knowledgePoint.count.mockResolvedValue(0);
    mockPrisma.questionDraft.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when deleting a referenced knowledge point", async () => {
    mockPrisma.questionKnowledgePoint.count.mockResolvedValue(1);
    const { DELETE } = await import("@/app/api/knowledge-points/[id]/route");
    const response = await DELETE(
      editorSessionRequest("http://localhost/api/knowledge-points/kp_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "kp_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Knowledge point is still referenced",
    });
    expect(mockPrisma.knowledgePoint.delete).not.toHaveBeenCalled();
  });

  it("returns 409 when deleting a referenced tag", async () => {
    mockPrisma.questionTag.count.mockResolvedValue(1);
    const { DELETE } = await import("@/app/api/tags/[id]/route");
    const response = await DELETE(
      editorSessionRequest("http://localhost/api/tags/tag_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "tag_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Tag is still referenced",
    });
    expect(mockPrisma.tag.delete).not.toHaveBeenCalled();
  });
});
