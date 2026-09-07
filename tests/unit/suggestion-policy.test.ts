import { describe, expect, it } from "vitest";

import {
  canSuggestionWriteDirectlyToQuestion,
  parseMetadataSuggestionPayload,
  suggestionPayloadMissingKnowledgePointId,
} from "@/lib/domain/suggestion-policy";

describe("canSuggestionWriteDirectlyToQuestion", () => {
  it("prevents agent suggestions from directly mutating confirmed questions", () => {
    expect(
      canSuggestionWriteDirectlyToQuestion({
        actor: "agent",
        kind: "metadata",
      }),
    ).toBe(false);
  });

  it("allows human review actions to directly mutate confirmed questions", () => {
    expect(
      canSuggestionWriteDirectlyToQuestion({
        actor: "human",
        kind: "metadata",
      }),
    ).toBe(true);
  });
});

describe("suggestionPayloadMissingKnowledgePointId", () => {
  it("is false when knowledge_points is omitted", () => {
    expect(suggestionPayloadMissingKnowledgePointId({ difficulty: { value: 2 } })).toBe(
      false,
    );
  });

  it("is true for mock classify payloads without ids", () => {
    expect(
      suggestionPayloadMissingKnowledgePointId({
        knowledge_points: [
          { value: "v-t 图像面积表示位移", confidence: 0.86, reason: "规则" },
        ],
      }),
    ).toBe(true);
  });
});

describe("parseMetadataSuggestionPayload", () => {
  it("omits missing keys and clears null difficulty and empty tags", () => {
    expect(parseMetadataSuggestionPayload({ risks: ["x"] })).toEqual({
      knowledgePointIds: undefined,
      difficulty: undefined,
      tagIds: undefined,
    });
    expect(
      parseMetadataSuggestionPayload({
        knowledge_points: [],
        difficulty: null,
        tag_ids: [],
      }),
    ).toEqual({
      knowledgePointIds: [],
      difficulty: null,
      tagIds: [],
    });
  });
});
