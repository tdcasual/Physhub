import { describe, expect, it } from "vitest";
import { QuestionType } from "@prisma/client";

import {
  questionTypeSchema,
  questionInputSchema,
  validatePublishableQuestion,
} from "@/lib/domain/question-schema";

describe("questionInputSchema", () => {
  it("accepts a valid single choice question with Markdown and LaTeX", () => {
    const result = questionInputSchema.safeParse({
      type: "SINGLE_CHOICE",
      stemMd: "如图所示，速度满足 $v = at$，下列说法正确的是？",
      options: [
        { label: "A", value: "速度保持不变" },
        { label: "B", value: "速度随时间均匀增加" },
      ],
      answer: { type: "single", value: "B" },
      solutionMd: "由 $v = at$ 可知速度与时间成正比。",
      difficulty: 2,
      knowledgePointIds: ["kp_1"],
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      options: [
        { label: "A", value: "速度保持不变" },
        { label: "B", value: "速度随时间均匀增加" },
      ],
      answer: { type: "single", value: "B" },
    });
  });

  it("matches Prisma QuestionType enum values", () => {
    expect(questionTypeSchema.options.toSorted()).toEqual(
      Object.values(QuestionType).toSorted(),
    );
  });
});

describe("validatePublishableQuestion", () => {
  it("returns required publish field errors once", () => {
    const errors = validatePublishableQuestion({
      stemMd: " ",
      knowledgePointIds: [" "],
    });

    expect(errors).toEqual([
      "题干不能为空",
      "必须确认题型",
      "必须填写答案",
      "必须确认知识点",
    ]);
  });

  it("rejects a choice question without options", () => {
    const errors = validatePublishableQuestion({
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项。",
      answer: { type: "single", value: "A" },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["选择题必须有选项"]);
  });

  it("rejects a single choice answer that does not match options", () => {
    const errors = validatePublishableQuestion({
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项。",
      options: [
        { label: "A", value: "选项 A" },
        { label: "B", value: "选项 B" },
      ],
      answer: { type: "single", value: "C" },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["答案必须匹配选项"]);
  });

  it("rejects a single choice question with a multiple answer", () => {
    const errors = validatePublishableQuestion({
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项。",
      options: [
        { label: "A", value: "选项 A" },
        { label: "B", value: "选项 B" },
      ],
      answer: { type: "multiple", value: ["B"] },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["答案必须匹配选项"]);
  });

  it("rejects a multiple choice question with a single answer", () => {
    const errors = validatePublishableQuestion({
      type: "MULTIPLE_CHOICE",
      stemMd: "选择所有正确选项。",
      options: [
        { label: "A", value: "选项 A" },
        { label: "B", value: "选项 B" },
      ],
      answer: { type: "single", value: "B" },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["答案必须匹配选项"]);
  });

  it("does not throw when a multiple answer is missing value", () => {
    const errors = validatePublishableQuestion({
      type: "MULTIPLE_CHOICE",
      stemMd: "选择所有正确选项。",
      options: [
        { label: "A", value: "选项 A" },
        { label: "B", value: "选项 B" },
      ],
      answer: { type: "multiple" } as never,
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["必须填写答案"]);
  });

  it("rejects multiple choice answer labels that do not match options", () => {
    const errors = validatePublishableQuestion({
      type: "MULTIPLE_CHOICE",
      stemMd: "选择所有正确选项。",
      options: [
        { label: "A", value: "选项 A" },
        { label: "B", value: "选项 B" },
      ],
      answer: { type: "multiple", value: ["A", "C"] },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["答案必须匹配选项"]);
  });
});
