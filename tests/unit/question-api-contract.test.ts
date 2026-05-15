import { describe, expect, it } from "vitest";

import type { QuestionInput } from "@/lib/domain/question-schema";
import { validatePublishableQuestion } from "@/lib/domain/question-schema";
import { buildPersistedQuestionContract } from "@/lib/domain/question-repository";
import { normalizeQuestionInput } from "@/lib/domain/question-service";

function validQuestionInput(
  overrides: Partial<QuestionInput> = {},
): QuestionInput {
  return {
    type: "SINGLE_CHOICE",
    stemMd: "小车做匀加速直线运动，下列说法正确的是？",
    options: [
      { label: "A", value: "速度保持不变" },
      { label: "B", value: "速度随时间均匀增加" },
    ],
    answer: { type: "single", value: "B" },
    solutionMd: "由 $v = v_0 + at$ 可知速度随时间均匀变化。",
    difficulty: 2,
    knowledgePointIds: ["kp_motion"],
    ...overrides,
  };
}

describe("question API publish validation contract", () => {
  it("accepts normalized publishable question input", () => {
    const input = normalizeQuestionInput(
      validQuestionInput({
        options: [
          { label: " a ", value: "速度保持不变" },
          { label: " b ", value: "速度随时间均匀增加" },
        ],
        answer: { type: "single", value: " b " },
      }),
    );

    expect(validatePublishableQuestion(input)).toEqual([]);
  });

  it("rejects an answer that does not match the option labels", () => {
    expect(
      validatePublishableQuestion(
        validQuestionInput({
          answer: { type: "single", value: "C" },
        }),
      ),
    ).toEqual(["答案必须匹配选项"]);
  });

  it("requires a knowledge point before a question can be created", () => {
    expect(
      validatePublishableQuestion({
        ...validQuestionInput(),
        knowledgePointIds: [],
      }),
    ).toEqual(["必须确认知识点"]);
  });
});

describe("buildPersistedQuestionContract", () => {
  it("stores options and answer with the public JSON contract", () => {
    const persistedQuestion = buildPersistedQuestionContract(
      normalizeQuestionInput(
        validQuestionInput({
          options: [
            { label: " a ", value: "速度保持不变" },
            { label: " b ", value: "速度随时间均匀增加" },
          ],
          answer: { type: "single", value: " b " },
          knowledgePointIds: ["kp_motion", "kp_velocity"],
        }),
      ),
    );

    expect(persistedQuestion).toMatchObject({
      status: "REVIEWED",
      optionsJson: [
        { label: "A", value: "速度保持不变" },
        { label: "B", value: "速度随时间均匀增加" },
      ],
      answerJson: { type: "single", value: "B" },
      primaryKnowledgePointId: "kp_motion",
    });
  });
});
