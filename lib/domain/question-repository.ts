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

async function buildNextPublicId(db: PrismaClientSingleton) {
  const questionCount = await db.question.count();

  return buildPublicQuestionId(manualPublicIdSlug, questionCount + 1);
}

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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const publicId = await buildNextPublicId(db);

      return await db.question.create({
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
    } catch (error) {
      if (isUniquePublicIdConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Unable to generate a unique public question id");
}
