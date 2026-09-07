import { Prisma, type QuestionType } from "@prisma/client";
import { ZodError } from "zod";

import { OWNER_SEED_EMAIL } from "@/lib/auth/human-auth";
import {
  omitAbsentDraftFields,
  questionDraftFieldSchema,
} from "@/lib/domain/draft-schema";
import {
  createQuestionDraft,
  DraftNotFoundError,
  DraftRelationError,
  toQuestionDraftDto,
  type DraftDbClient,
  type QuestionDraftDto,
} from "@/lib/domain/draft-repository";
import {
  buildManualPublicQuestionId,
  buildPersistedQuestionContract,
  parseAndValidateQuestionInput,
  QuestionPersistenceError,
  QuestionRelationError,
  QuestionValidationError,
} from "@/lib/domain/question-repository";
import {
  answerSchema,
  optionSchema,
  questionInputSchema,
  validatePublishableQuestion,
  type QuestionInput,
} from "@/lib/domain/question-schema";
import {
  normalizeQuestionDraftInput,
  normalizeQuestionInput,
} from "@/lib/domain/question-service";

const PROMOTABLE_STATUSES = ["DRAFT", "NEEDS_REVIEW"] as const;
const maxPublicIdAttempts = 5;

const promoteQuestionInclude = {
  primaryKnowledgePoint: true,
  knowledgePoints: {
    include: {
      knowledgePoint: true,
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.QuestionInclude;

type PromotedQuestion = Prisma.QuestionGetPayload<{
  include: typeof promoteQuestionInclude;
}>;

export type PromoteDraftResult = {
  draft: QuestionDraftDto;
  question: PromotedQuestion;
};

export class DraftNotPromotableError extends Error {
  constructor(message = "Draft is not promotable") {
    super(message);
    this.name = "DraftNotPromotableError";
  }
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;

async function getDb(db?: DraftDbClient): Promise<DraftDbClient> {
  if (db) {
    return db;
  }

  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

function getValidationMessage(error: ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function asIdArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return [];
  }

  return value.filter((item) => item.trim().length > 0);
}

function asOptions(value: Prisma.JsonValue | null | undefined) {
  const parsed = optionSchema.array().safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

function asAnswer(value: Prisma.JsonValue | null | undefined) {
  const parsed = answerSchema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

function mapDraftToPartialInput(draft: {
  type: QuestionType | null;
  stemMd: string | null;
  optionsJson: Prisma.JsonValue | null;
  answerJson: Prisma.JsonValue | null;
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: Prisma.JsonValue | null;
}): Partial<QuestionInput> {
  const options = asOptions(draft.optionsJson);
  const answer = asAnswer(draft.answerJson);

  return {
    ...(draft.type ? { type: draft.type } : {}),
    ...(draft.stemMd != null ? { stemMd: draft.stemMd } : {}),
    ...(options ? { options } : {}),
    ...(answer ? { answer } : {}),
    ...(draft.solutionMd != null ? { solutionMd: draft.solutionMd } : {}),
    ...(draft.difficulty != null ? { difficulty: draft.difficulty } : {}),
    knowledgePointIds: asIdArray(draft.knowledgePointIds),
  };
}

function publishableInputFromDraft(draft: {
  type: QuestionType | null;
  stemMd: string | null;
  optionsJson: Prisma.JsonValue | null;
  answerJson: Prisma.JsonValue | null;
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: Prisma.JsonValue | null;
}): QuestionInput {
  const mapped = mapDraftToPartialInput(draft);
  const normalized =
    mapped.answer !== undefined || mapped.options !== undefined
      ? normalizeQuestionDraftInput(mapped)
      : mapped;
  const publishErrors = validatePublishableQuestion(normalized);

  if (publishErrors.length > 0) {
    throw new QuestionValidationError(publishErrors.join("; "));
  }

  const parsed = questionInputSchema.safeParse(normalized);

  if (!parsed.success) {
    throw new QuestionValidationError(getValidationMessage(parsed.error));
  }

  return normalizeQuestionInput(parsed.data);
}

async function assertKnowledgePointsExist(
  db: DraftDbClient,
  ids: string[],
): Promise<void> {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return;
  }

  const found = await db.knowledgePoint.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    throw new QuestionRelationError("Knowledge point not found");
  }
}

async function assertTagsExist(db: DraftDbClient, ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return;
  }

  const found = await db.tag.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    throw new DraftRelationError("Tag not found");
  }
}

async function assertRawAssetExists(
  db: DraftDbClient,
  id: string | null,
): Promise<void> {
  if (!id) {
    return;
  }

  const rawAsset = await db.rawAsset.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!rawAsset) {
    throw new DraftRelationError("Raw asset not found");
  }
}

async function resolveOwnerUserId(db: DraftDbClient): Promise<string> {
  const owner = await db.user.findUnique({
    where: { email: OWNER_SEED_EMAIL },
    select: { id: true },
  });

  if (!owner) {
    throw new QuestionPersistenceError();
  }

  return owner.id;
}

function constraintIncludes(
  error: Prisma.PrismaClientKnownRequestError,
  field: string,
) {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes(field);
  }

  return typeof target === "string" && target.includes(field);
}

function isUniquePublicIdConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    constraintIncludes(error, "publicId")
  );
}

function isPrismaUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isRelationFailure(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2003" || error.code === "P2025")
  );
}

function relationFailureError(error: Prisma.PrismaClientKnownRequestError) {
  const blob = JSON.stringify(error.meta ?? {}).toLowerCase();

  if (blob.includes("rawasset") || blob.includes("sourcerawasset")) {
    return new DraftRelationError("Raw asset not found");
  }

  if (blob.includes("tag")) {
    return new DraftRelationError("Tag not found");
  }

  return new QuestionRelationError("Knowledge point not found");
}

function parseQuestionPromoteExtras(rawInput: unknown): {
  tagIds?: string[];
  sourceRawAssetId?: string;
} {
  const parsed = questionDraftFieldSchema
    .pick({ tagIds: true, sourceRawAssetId: true })
    .safeParse(omitAbsentDraftFields(rawInput));

  if (!parsed.success) {
    throw new QuestionValidationError(getValidationMessage(parsed.error));
  }

  return parsed.data;
}

async function runWithPromoteRetry<T>(
  db: DraftDbClient,
  work: (tx: DraftDbClient) => Promise<T>,
): Promise<T> {
  if (!("$transaction" in db)) {
    return work(db);
  }

  const prisma = db as PrismaClientSingleton;

  for (let attempt = 0; attempt < maxPublicIdAttempts; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => work(tx));
    } catch (error) {
      if (isUniquePublicIdConflict(error)) {
        continue;
      }

      // Any unique conflict in this tx except publicId (including missing target).
      if (isPrismaUniqueConflict(error)) {
        throw new DraftNotPromotableError();
      }

      if (isRelationFailure(error)) {
        throw relationFailureError(error);
      }

      throw error;
    }
  }

  throw new QuestionPersistenceError(
    "Unable to generate a unique public question id",
  );
}

function buildQuestionSnapshot(
  question: PromotedQuestion,
  knowledgePointIds: string[],
  tagIds: string[],
): Prisma.InputJsonValue {
  return {
    id: question.id,
    publicId: question.publicId,
    type: question.type,
    status: question.status,
    stemMd: question.stemMd,
    optionsJson: question.optionsJson ?? null,
    answerJson: question.answerJson,
    solutionMd: question.solutionMd,
    difficulty: question.difficulty,
    sourceRawAssetId: question.sourceRawAssetId,
    primaryKnowledgePointId: question.primaryKnowledgePointId,
    knowledgePointIds,
    tagIds,
    createdById: question.createdById,
    reviewedById: question.reviewedById,
    createdAt: question.createdAt.toISOString(),
  };
}

async function promoteInTransaction(
  tx: DraftDbClient,
  id: string,
): Promise<PromoteDraftResult> {
  // Conditional UPDATE is the race arbitration; do not check-then-act.
  const claimed = await tx.questionDraft.updateMany({
    where: {
      id,
      status: { in: [...PROMOTABLE_STATUSES] },
    },
    data: {
      status: "PROMOTED",
      promotedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    throw new DraftNotPromotableError();
  }

  const draft = await tx.questionDraft.findUnique({ where: { id } });

  if (!draft) {
    throw new DraftNotFoundError();
  }

  const input = publishableInputFromDraft(draft);
  const tagIds = asIdArray(draft.tagIds);

  await assertKnowledgePointsExist(tx, input.knowledgePointIds);
  await assertTagsExist(tx, tagIds);
  await assertRawAssetExists(tx, draft.sourceRawAssetId);

  const ownerId = await resolveOwnerUserId(tx);
  const persisted = buildPersistedQuestionContract(input);
  const publicId = buildManualPublicQuestionId();

  // Helper Pick omits sourceRawAssetId and tags; persist both explicitly.
  const question = await tx.question.create({
    data: {
      ...persisted,
      publicId,
      sourceRawAssetId: draft.sourceRawAssetId,
      createdById: ownerId,
      reviewedById: ownerId,
      knowledgePoints: {
        create: input.knowledgePointIds.map((knowledgePointId, index) => ({
          knowledgePointId,
          role: index === 0 ? "primary" : "secondary",
        })),
      },
      ...(tagIds.length > 0
        ? {
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: promoteQuestionInclude,
  });

  await tx.questionVersion.create({
    data: {
      questionId: question.id,
      version: 1,
      snapshot: buildQuestionSnapshot(question, input.knowledgePointIds, tagIds),
      createdById: ownerId,
    },
  });

  await tx.reviewRecord.create({
    data: {
      resourceType: "question_draft",
      resourceId: draft.id,
      action: "promoted",
      actorId: ownerId,
      diff: { questionId: question.id },
    },
  });

  const promotedDraft = await tx.questionDraft.update({
    where: { id: draft.id },
    data: {
      promotedQuestionId: question.id,
    },
  });

  await tx.suggestion.updateMany({
    where: {
      draftId: draft.id,
      questionId: null,
    },
    data: {
      questionId: question.id,
    },
  });

  return {
    draft: toQuestionDraftDto(promotedDraft),
    question,
  };
}

export async function promoteDraftToQuestion(
  id: string,
  options?: { db?: DraftDbClient },
): Promise<PromoteDraftResult> {
  const db = await getDb(options?.db);
  const existing = await db.questionDraft.findUnique({ where: { id } });

  if (!existing) {
    throw new DraftNotFoundError();
  }

  return runWithPromoteRetry(db, (tx) => promoteInTransaction(tx, id));
}

export async function createQuestionByPromotingDraft(
  rawInput: unknown,
): Promise<PromoteDraftResult> {
  const input = parseAndValidateQuestionInput(rawInput);
  const extras = parseQuestionPromoteExtras(rawInput);
  const db = await getDb();

  return runWithPromoteRetry(db, async (tx) => {
    const draft = await createQuestionDraft(
      {
        type: input.type,
        stemMd: input.stemMd,
        options: input.options,
        answer: input.answer,
        solutionMd: input.solutionMd,
        difficulty: input.difficulty,
        knowledgePointIds: input.knowledgePointIds,
        tagIds: extras.tagIds,
        sourceRawAssetId: extras.sourceRawAssetId,
      },
      { actor: "human", db: tx },
    );

    return promoteDraftToQuestion(draft.id, { db: tx });
  });
}

export function mapPromoteApiError(error: unknown): {
  error: string;
  status: number;
} {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof QuestionValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof DraftNotFoundError) {
    return { error: error.message, status: 404 };
  }

  if (error instanceof DraftNotPromotableError) {
    return { error: error.message, status: 409 };
  }

  if (
    error instanceof DraftRelationError ||
    error instanceof QuestionRelationError
  ) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof QuestionPersistenceError) {
    return { error: error.message, status: 500 };
  }

  return { error: "Unable to promote draft", status: 500 };
}
