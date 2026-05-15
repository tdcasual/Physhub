import { describe, expect, it } from "vitest";

import { canSuggestionWriteDirectlyToQuestion } from "@/lib/domain/suggestion-policy";

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
