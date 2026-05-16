import { prisma } from "@/lib/db/prisma";

export type QuestionSetInput = {
  title: string;
  questionIds: string[];
};

export class QuestionSetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionSetValidationError";
  }
}

export class QuestionSetRelationError extends Error {
  constructor(message = "Question not found") {
    super(message);
    this.name = "QuestionSetRelationError";
  }
}

export class QuestionSetPersistenceError extends Error {
  constructor(message = "Unable to create question set") {
    super(message);
    this.name = "QuestionSetPersistenceError";
  }
}

function isQuestionRelationFailure(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P2003" || error.code === "P2025")
  );
}

export function buildQuestionSetItems(questionIds: string[]) {
  return questionIds.map((questionId, index) => ({
    questionId,
    sortOrder: index + 1,
  }));
}

export function validateQuestionSetInput(input: unknown): QuestionSetInput {
  if (!input || typeof input !== "object") {
    throw new QuestionSetValidationError("title is required");
  }

  const candidate = input as Record<string, unknown>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";

  if (!title) {
    throw new QuestionSetValidationError("title is required");
  }

  if (
    !Array.isArray(candidate.questionIds) ||
    candidate.questionIds.length === 0 ||
    !candidate.questionIds.every(
      (questionId) => typeof questionId === "string" && questionId.trim(),
    )
  ) {
    throw new QuestionSetValidationError(
      "questionIds must be a non-empty array",
    );
  }

  const questionIds = candidate.questionIds.map((questionId) =>
    questionId.trim(),
  );

  if (new Set(questionIds).size !== questionIds.length) {
    throw new QuestionSetValidationError("questionIds must be unique");
  }

  return { title, questionIds };
}

export async function createQuestionSet(input: unknown) {
  const questionSetInput = validateQuestionSetInput(input);

  try {
    return await prisma.questionSet.create({
      data: {
        title: questionSetInput.title,
        items: { create: buildQuestionSetItems(questionSetInput.questionIds) },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  } catch (error) {
    if (isQuestionRelationFailure(error)) {
      throw new QuestionSetRelationError();
    }

    throw new QuestionSetPersistenceError();
  }
}
