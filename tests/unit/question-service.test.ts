import { describe, expect, it } from "vitest";

import {
  buildPublicQuestionId,
  normalizeQuestionInput,
} from "@/lib/domain/question-service";
import type { QuestionInput } from "@/lib/domain/question-schema";

function questionInput(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    type: "SINGLE_CHOICE",
    stemMd: "题干",
    options: [
      { label: "A", value: "选项 A" },
      { label: "B", value: "选项 B" },
    ],
    answer: { type: "single", value: "A" },
    solutionMd: "解析",
    difficulty: 2,
    knowledgePointIds: ["kp_1"],
    ...overrides,
  };
}

describe("buildPublicQuestionId", () => {
  it("builds a padded public question id", () => {
    expect(buildPublicQuestionId("motion", 1)).toBe("q_motion_0001");
  });
});

describe("normalizeQuestionInput", () => {
  it("uppercases and trims option labels", () => {
    const normalized = normalizeQuestionInput(
      questionInput({
        options: [
          { label: "a", value: "选项 A" },
          { label: " b ", value: "选项 B" },
        ],
      }),
    );

    expect(normalized.options?.map((option) => option.label)).toEqual([
      "A",
      "B",
    ]);
  });

  it("trims stem, solution, and option values", () => {
    const normalized = normalizeQuestionInput(
      questionInput({
        stemMd: "  $v = at$  ",
        solutionMd: "  由公式可知。  ",
        options: [
          { label: " A ", value: "  速度增加  " },
          { label: "B", value: "  速度不变  " },
        ],
      }),
    );

    expect(normalized.stemMd).toBe("$v = at$");
    expect(normalized.solutionMd).toBe("由公式可知。");
    expect(normalized.options?.map((option) => option.value)).toEqual([
      "速度增加",
      "速度不变",
    ]);
  });

  it("preserves answer and knowledge point fields", () => {
    const answer: QuestionInput["answer"] = { type: "single", value: "A" };
    const normalized = normalizeQuestionInput(
      questionInput({
        answer,
        knowledgePointIds: ["kp_motion", "kp_velocity"],
      }),
    );

    expect(normalized.answer).toBe(answer);
    expect(normalized.knowledgePointIds).toEqual(["kp_motion", "kp_velocity"]);
  });
});
