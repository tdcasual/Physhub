import { describe, expect, it } from "vitest";

import {
  questionInputSchema,
  validatePublishableQuestion,
} from "@/lib/domain/question-schema";

describe("questionInputSchema", () => {
  it("accepts a valid single choice question with Markdown and LaTeX", () => {
    const result = questionInputSchema.safeParse({
      type: "SINGLE_CHOICE",
      stemMd: "如图所示，速度满足 $v = at$，下列说法正确的是？",
      options: [
        { label: "A", contentMd: "速度保持不变" },
        { label: "B", contentMd: "速度随时间均匀增加" },
      ],
      answer: { kind: "single", value: "B" },
      solutionMd: "由 $v = at$ 可知速度与时间成正比。",
      difficulty: 2,
      knowledgePointIds: ["kp_1"],
    });

    expect(result.success).toBe(true);
  });
});

describe("validatePublishableQuestion", () => {
  it("rejects a single choice answer that does not match options", () => {
    const errors = validatePublishableQuestion({
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项。",
      options: [
        { label: "A", contentMd: "选项 A" },
        { label: "B", contentMd: "选项 B" },
      ],
      answer: { kind: "single", value: "C" },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toEqual(["答案必须匹配选项"]);
  });
});
