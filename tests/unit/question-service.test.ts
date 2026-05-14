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

  it("rejects invalid topic slugs", () => {
    expect(() => buildPublicQuestionId("Motion", 1)).toThrow(
      "topicSlug must contain only lowercase letters, numbers, and underscores",
    );
    expect(() => buildPublicQuestionId("linear-motion", 1)).toThrow(
      "topicSlug must contain only lowercase letters, numbers, and underscores",
    );
  });

  it("rejects non-positive or non-integer sequences", () => {
    expect(() => buildPublicQuestionId("motion", 0)).toThrow(
      "sequence must be a positive integer",
    );
    expect(() => buildPublicQuestionId("motion", 1.5)).toThrow(
      "sequence must be a positive integer",
    );
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

  it("normalizes single choice answer labels to match option labels", () => {
    const normalized = normalizeQuestionInput(
      questionInput({
        options: [
          { label: " a ", value: "选项 A" },
          { label: "B", value: "选项 B" },
        ],
        answer: { type: "single", value: " a " },
        knowledgePointIds: ["kp_motion", "kp_velocity"],
      }),
    );

    expect(normalized.answer).toEqual({ type: "single", value: "A" });
    expect(normalized.knowledgePointIds).toEqual(["kp_motion", "kp_velocity"]);
  });

  it("normalizes multiple choice answer labels to match option labels", () => {
    const normalized = normalizeQuestionInput(
      questionInput({
        type: "MULTIPLE_CHOICE",
        answer: { type: "multiple", value: [" a ", "b"] },
      }),
    );

    expect(normalized.answer).toEqual({ type: "multiple", value: ["A", "B"] });
  });

  it("trims text answers without uppercasing the content", () => {
    const normalized = normalizeQuestionInput(
      questionInput({
        type: "CALCULATION",
        options: undefined,
        answer: { type: "text", value: "  Mg  " },
      }),
    );

    expect(normalized.answer).toEqual({ type: "text", value: "Mg" });
  });
});
