import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("suggestion review route", () => {
  beforeEach(() => {
    mockPrisma.suggestion.findUnique.mockReset();
    mockPrisma.suggestion.update.mockReset();
    mockPrisma.reviewRecord.create.mockReset();
    mockPrisma.question.update.mockReset();
    mockPrisma.$transaction.mockReset();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma),
    );
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
});
