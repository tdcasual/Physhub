import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockQuestionSetCreate } = vi.hoisted(() => ({
  mockQuestionSetCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    questionSet: {
      create: mockQuestionSetCreate,
    },
  },
}));

import {
  buildQuestionSetItems,
  createQuestionSet,
  QuestionSetPersistenceError,
  QuestionSetRelationError,
  QuestionSetValidationError,
  validateQuestionSetInput,
} from "@/lib/domain/question-set-service";
import { mapQuestionSetApiError } from "@/app/api/question-sets/route";

function prismaKnownRequestError(code: string) {
  return Object.assign(new Error(`Prisma ${code}`), {
    code,
    clientVersion: "7.8.0",
  });
}

describe("question set service", () => {
  beforeEach(() => {
    mockQuestionSetCreate.mockReset();
  });

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

  it("creates question sets with nested question set item data", async () => {
    const persistedQuestionSet = {
      id: "qs_1",
      title: "练习卷",
      items: [
        { id: "item_1", questionSetId: "qs_1", questionId: "q1", sortOrder: 1 },
        { id: "item_2", questionSetId: "qs_1", questionId: "q2", sortOrder: 2 },
      ],
    };
    mockQuestionSetCreate.mockResolvedValue(persistedQuestionSet);

    await expect(
      createQuestionSet({ title: " 练习卷 ", questionIds: [" q1 ", "q2"] }),
    ).resolves.toEqual(persistedQuestionSet);

    expect(mockQuestionSetCreate).toHaveBeenCalledWith({
      data: {
        title: "练习卷",
        items: {
          create: [
            { questionId: "q1", sortOrder: 1 },
            { questionId: "q2", sortOrder: 2 },
          ],
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });

  it.each(["P2003", "P2025"])(
    "maps Prisma %s relation failures to a question relation error",
    async (code) => {
      mockQuestionSetCreate.mockRejectedValue(prismaKnownRequestError(code));

      await expect(
        createQuestionSet({ title: "练习卷", questionIds: ["missing_q"] }),
      ).rejects.toBeInstanceOf(QuestionSetRelationError);
    },
  );

  it("maps unexpected Prisma failures to a stable persistence error", async () => {
    mockQuestionSetCreate.mockRejectedValue(
      new Error("database password leaked"),
    );

    await expect(
      createQuestionSet({ title: "练习卷", questionIds: ["q1"] }),
    ).rejects.toBeInstanceOf(QuestionSetPersistenceError);
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

  it("maps missing question relation errors to stable 422 responses", () => {
    expect(mapQuestionSetApiError(new QuestionSetRelationError())).toEqual({
      error: "Question not found",
      status: 422,
    });
  });

  it("maps persistence errors without leaking internals", () => {
    expect(
      mapQuestionSetApiError(new QuestionSetPersistenceError("secret")),
    ).toEqual({
      error: "Unable to create question set",
      status: 500,
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
