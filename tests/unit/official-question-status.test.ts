import { describe, expect, it, vi } from "vitest";

import { updateOfficialQuestionStatus } from "@/lib/domain/official-question";

function officialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "question_1",
    publicId: "q_1",
    type: "SINGLE_CHOICE",
    status: "REVIEWED",
    stemMd: "stem",
    optionsJson: [
      { label: "A", value: "one" },
      { label: "B", value: "two" },
    ],
    answerJson: { type: "single", value: "A" },
    solutionMd: null,
    difficulty: 2,
    sourceRawAssetId: null,
    primaryKnowledgePointId: "kp_1",
    hasRenderedImage: false,
    publishedAt: null,
    createdById: "user_1",
    reviewedById: "user_1",
    createdAt: new Date("2026-05-16T10:00:00.000Z"),
    updatedAt: new Date("2026-05-16T10:00:00.000Z"),
    knowledgePoints: [{ knowledgePointId: "kp_1" }],
    tags: [],
    versions: [{ version: 1 }],
    sourceRawAsset: null,
    primaryKnowledgePoint: null,
    ...overrides,
  };
}

describe("updateOfficialQuestionStatus", () => {
  it("refuses to publish a question with no knowledge points", async () => {
    const update = vi.fn();
    const db = {
      $transaction: async (
        callback: (tx: {
          question: { findUnique: () => Promise<unknown>; update: typeof update };
        }) => Promise<unknown>,
      ) =>
        callback({
          question: {
            findUnique: async () =>
              officialRow({
                knowledgePoints: [],
                primaryKnowledgePointId: null,
              }),
            update,
          },
        }),
    };

    await expect(
      updateOfficialQuestionStatus(
        "question_1",
        "PUBLISHED",
        "user_1",
        db as never,
      ),
    ).rejects.toThrow("必须确认知识点");
    expect(update).not.toHaveBeenCalled();
  });
});
