import { describe, expect, it } from "vitest";

import {
  omitAbsentDraftFields,
  parseHumanQuestionDraftInput,
} from "@/lib/domain/draft-schema";
import {
  parseAndValidateQuestionInput,
  QuestionValidationError,
} from "@/lib/domain/question-repository";

describe("parseHumanQuestionDraftInput", () => {
  it("keeps difficulty null instead of omitting it", () => {
    const parsed = parseHumanQuestionDraftInput({
      stemMd: "题干",
      difficulty: null,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.difficulty).toBeNull();
  });

  it("accepts an empty option row and an empty answer", () => {
    const parsed = parseHumanQuestionDraftInput({
      type: "SINGLE_CHOICE",
      stemMd: "题干",
      options: [
        { label: "A", value: "完整" },
        { label: "B", value: "" },
      ],
      answer: { type: "single", value: "" },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("expected success");
    }
    expect(parsed.data.options).toEqual([
      { label: "A", value: "完整" },
      { label: "B", value: "" },
    ]);
    expect(parsed.data.answer).toEqual({ type: "single", value: "" });
  });
});

describe("omitAbsentDraftFields", () => {
  it("does not drop explicit difficulty null, empty answers, or empty option rows", () => {
    expect(
      omitAbsentDraftFields({
        difficulty: null,
        answer: { type: "single", value: "" },
        options: [{ label: "B", value: "" }],
      }),
    ).toEqual({
      difficulty: null,
      answer: { type: "single", value: "" },
      options: [{ label: "B", value: "" }],
    });
  });
});

describe("official promote schema stays strict", () => {
  it("rejects an empty option row", () => {
    expect(() =>
      parseAndValidateQuestionInput({
        type: "SINGLE_CHOICE",
        stemMd: "题干",
        options: [
          { label: "A", value: "完整" },
          { label: "B", value: "" },
        ],
        answer: { type: "single", value: "A" },
        knowledgePointIds: ["kp_1"],
      }),
    ).toThrow(QuestionValidationError);
  });
});
