import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import {
  questionInputSchema,
  validatePublishableQuestion,
  type QuestionInput,
} from "@/lib/domain/question-schema";
import {
  buildPublicQuestionId,
  normalizeQuestionInput,
} from "@/lib/domain/question-service";

const manualPublicIdSlug = "manual";
const maxPublicIdAttempts = 5;

const questionInclude = {
  primaryKnowledgePoint: true,
  knowledgePoints: {
    include: {
      knowledgePoint: true,
    },
  },
} satisfies Prisma.QuestionInclude;

type QuestionWithRelations = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;

export type PersistedQuestionContract = Pick<
  Prisma.QuestionUncheckedCreateInput,
  | "type"
  | "stemMd"
  | "optionsJson"
  | "answerJson"
  | "solutionMd"
  | "difficulty"
  | "primaryKnowledgePointId"
  | "status"
>;

export class QuestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionValidationError";
  }
}

export class QuestionRelationError extends Error {
  constructor(message = "Knowledge point not found") {
    super(message);
    this.name = "QuestionRelationError";
  }
}

export class QuestionPersistenceError extends Error {
  constructor(message = "Unable to create question") {
    super(message);
    this.name = "QuestionPersistenceError";
  }
}

export function buildManualPublicQuestionId(
  entropy = crypto.randomUUID(),
): string {
  const suffix = entropy.replace(/-/g, "").slice(0, 10).toLowerCase();

  if (!/^[a-z0-9]{10}$/.test(suffix)) {
    throw new Error(
      "public question id entropy must contain at least 10 hex characters",
    );
  }

  return buildPublicQuestionId(`${manualPublicIdSlug}_${suffix}`, 1);
}

export function buildPersistedQuestionContract(
  input: QuestionInput,
): PersistedQuestionContract {
  return {
    type: input.type,
    stemMd: input.stemMd,
    optionsJson: input.options,
    answerJson: input.answer,
    solutionMd: input.solutionMd ?? null,
    difficulty: input.difficulty ?? null,
    primaryKnowledgePointId: input.knowledgePointIds[0],
    status: "REVIEWED",
  };
}

function getValidationMessage(error: ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function parseAndValidateQuestionInput(rawInput: unknown) {
  const parsed = questionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    throw new QuestionValidationError(getValidationMessage(parsed.error));
  }

  const input = normalizeQuestionInput(parsed.data);
  const publishErrors = validatePublishableQuestion(input);

  if (publishErrors.length > 0) {
    throw new QuestionValidationError(publishErrors.join("; "));
  }

  return input;
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
type TransactionClient = Omit<
  PrismaClientSingleton,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function getDb(): Promise<PrismaClientSingleton> {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

function isUniquePublicIdConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("publicId")
  );
}

function isRelationFailure(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2025")
  );
}

async function createQuestionWithCandidate(
  tx: TransactionClient,
  input: QuestionInput,
  persistedQuestion: PersistedQuestionContract,
  publicId: string,
) {
  return tx.question.create({
    data: {
      ...persistedQuestion,
      publicId,
      knowledgePoints: {
        create: input.knowledgePointIds.map((knowledgePointId, index) => ({
          knowledgePointId,
          role: index === 0 ? "primary" : "secondary",
        })),
      },
    },
    include: questionInclude,
  });
}

export async function listQuestions(): Promise<QuestionWithRelations[]> {
  const db = await getDb();

  return db.question.findMany({
    include: questionInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getQuestion(
  id: string,
): Promise<QuestionWithRelations | null> {
  const db = await getDb();

  return db.question.findUnique({
    where: { id },
    include: questionInclude,
  });
}

export async function createQuestion(
  rawInput: unknown,
): Promise<QuestionWithRelations> {
  const input = parseAndValidateQuestionInput(rawInput);
  const persistedQuestion = buildPersistedQuestionContract(input);
  const db = await getDb();

  for (let attempt = 0; attempt < maxPublicIdAttempts; attempt += 1) {
    try {
      const publicId = buildManualPublicQuestionId();

      return await db.$transaction((tx) =>
        createQuestionWithCandidate(tx, input, persistedQuestion, publicId),
      );
    } catch (error) {
      if (isUniquePublicIdConflict(error)) {
        continue;
      }

      if (isRelationFailure(error)) {
        throw new QuestionRelationError();
      }

      throw error;
    }
  }

  throw new QuestionPersistenceError(
    "Unable to generate a unique public question id",
  );
}
