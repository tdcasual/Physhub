import { describe, expect, it } from "vitest";

import type { QuestionInput } from "@/lib/domain/question-schema";
import { validatePublishableQuestion } from "@/lib/domain/question-schema";
import {
  buildManualPublicQuestionId,
  buildPersistedQuestionContract,
  createQuestion,
  QuestionPersistenceError,
  QuestionRelationError,
  QuestionValidationError,
} from "@/lib/domain/question-repository";
import { normalizeQuestionInput } from "@/lib/domain/question-service";
import { mapQuestionApiError } from "@/app/api/questions/route";

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

describe("buildManualPublicQuestionId", () => {
  it("builds an independent human-readable manual id candidate", () => {
    expect(buildManualPublicQuestionId("abc123def456")).toBe(
      "q_manual_abc123def4_0001",
    );
  });

  it("rejects entropy that cannot form a valid slug suffix", () => {
    expect(() => buildManualPublicQuestionId("not-valid!")).toThrow(
      "public question id entropy must contain at least 10 hex characters",
    );
  });
});

describe("createQuestion", () => {
  it("does not insert REVIEWED questions outside promote", async () => {
    await expect(createQuestion(validQuestionInput())).rejects.toThrow(
      "Official questions must be created by promoting a draft",
    );
  });
});

describe("mapQuestionApiError", () => {
  it("maps malformed JSON to a 400 response", () => {
    expect(mapQuestionApiError(new SyntaxError("Unexpected token"))).toEqual({
      error: "Malformed JSON request body",
      status: 400,
    });
  });

  it("maps domain validation errors to a 400 response", () => {
    expect(mapQuestionApiError(new QuestionValidationError("题干不能为空"))).toEqual({
      error: "题干不能为空",
      status: 400,
    });
  });

  it("maps missing relation errors to a clear 422 response", () => {
    expect(mapQuestionApiError(new QuestionRelationError())).toEqual({
      error: "Knowledge point not found",
      status: 422,
    });
  });

  it("maps unexpected persistence failures without leaking internals", () => {
    expect(mapQuestionApiError(new Error("database password leaked"))).toEqual({
      error: "Unable to create question",
      status: 500,
    });
    expect(mapQuestionApiError(new QuestionPersistenceError())).toEqual({
      error: "Unable to create question",
      status: 500,
    });
  });
});
