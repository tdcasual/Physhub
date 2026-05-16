import { describe, expect, it } from "vitest";

import {
  buildQuestionSetItems,
  QuestionSetValidationError,
  validateQuestionSetInput,
} from "@/lib/domain/question-set-service";
import { mapQuestionSetApiError } from "@/app/api/question-sets/route";

describe("question set service", () => {
  it("assigns stable sort order", () => {
    expect(buildQuestionSetItems(["q1", "q2"])).toEqual([
      { questionId: "q1", sortOrder: 1 },
      { questionId: "q2", sortOrder: 2 },
    ]);
  });

  it("accepts a valid title and question id list", () => {
    expect(
      validateQuestionSetInput({
        title: "期中复习卷",
        questionIds: ["q1", "q2"],
      }),
    ).toEqual({
      title: "期中复习卷",
      questionIds: ["q1", "q2"],
    });
  });

  it("rejects missing or blank titles", () => {
    expect(() =>
      validateQuestionSetInput({ title: " ", questionIds: ["q1"] }),
    ).toThrow("title is required");
    expect(() => validateQuestionSetInput({ questionIds: ["q1"] })).toThrow(
      "title is required",
    );
  });

  it("rejects missing or invalid question id arrays", () => {
    expect(() =>
      validateQuestionSetInput({ title: "练习卷", questionIds: [] }),
    ).toThrow("questionIds must be a non-empty array");
    expect(() =>
      validateQuestionSetInput({ title: "练习卷", questionIds: "q1" }),
    ).toThrow("questionIds must be a non-empty array");
  });

  it("rejects duplicate question ids before persistence", () => {
    expect(() =>
      validateQuestionSetInput({
        title: "练习卷",
        questionIds: ["q1", "q2", "q1"],
      }),
    ).toThrow("questionIds must be unique");
  });
});

describe("question set route helpers", () => {
  it("maps validation errors to stable 400 responses", () => {
    expect(
      mapQuestionSetApiError(
        new QuestionSetValidationError("questionIds must be unique"),
      ),
    ).toEqual({
      error: "questionIds must be unique",
      status: 400,
    });
  });

  it("maps malformed JSON to a stable 400 response", () => {
    expect(mapQuestionSetApiError(new SyntaxError("Unexpected token"))).toEqual(
      {
        error: "Malformed JSON request body",
        status: 400,
      },
    );
  });
});
