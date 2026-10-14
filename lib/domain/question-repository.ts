import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import {
  questionInputSchema,
  validatePublishableQuestion,
  type QuestionInput,
} from "@/lib/domain/question-schema";
import {
  buildPublicQuestionId,
  normalizeQuestionDraftInput,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function partialQuestionFromUnknown(raw: unknown): Partial<QuestionInput> {
  if (!isRecord(raw)) {
    return {};
  }

  const partial: Partial<QuestionInput> = {};

  if (typeof raw.type === "string") {
    partial.type = raw.type as QuestionInput["type"];
  }

  if (typeof raw.stemMd === "string") {
    partial.stemMd = raw.stemMd;
  }

  if (Array.isArray(raw.options)) {
    partial.options = raw.options as QuestionInput["options"];
  }

  if (isRecord(raw.answer)) {
    partial.answer = raw.answer as QuestionInput["answer"];
  }

  if (Array.isArray(raw.knowledgePointIds)) {
    partial.knowledgePointIds = raw.knowledgePointIds.filter(
      (id): id is string => typeof id === "string",
    );
  }

  return partial;
}

function normalizedPartialQuestion(raw: unknown): Partial<QuestionInput> {
  const partial = partialQuestionFromUnknown(raw);

  if (partial.answer === undefined && partial.options === undefined) {
    return partial;
  }

  try {
    return normalizeQuestionDraftInput(partial);
  } catch {
    return partial;
  }
}

export function parseAndValidateQuestionInput(rawInput: unknown) {
  const publishErrors = validatePublishableQuestion(
    normalizedPartialQuestion(rawInput),
  );

  if (publishErrors.length > 0) {
    throw new QuestionValidationError(publishErrors.join("; "));
  }

  const parsed = questionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    throw new QuestionValidationError(getValidationMessage(parsed.error));
  }

  const input = normalizeQuestionInput(parsed.data);
  const normalizedErrors = validatePublishableQuestion(input);

  if (normalizedErrors.length > 0) {
    throw new QuestionValidationError(normalizedErrors.join("; "));
  }

  return input;
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;

async function getDb(): Promise<PrismaClientSingleton> {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

export async function listQuestions(options?: {
  take?: number;
}): Promise<QuestionWithRelations[]> {
  const db = await getDb();
  const take = options?.take ?? 50;

  return db.question.findMany({
    include: questionInclude,
    orderBy: {
      createdAt: "desc",
    },
    take,
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
  rawInput?: unknown,
): Promise<never> {
  void rawInput;
  throw new QuestionPersistenceError(
    "Official questions must be created by promoting a draft",
  );
}
