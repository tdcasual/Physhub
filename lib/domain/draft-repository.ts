import type {
  DraftStatus,
  JobStatus,
  Prisma,
  QuestionType,
  RawAssetKind,
  RawAssetStatus,
} from "@prisma/client";

import type { QuestionDraftWriteInput } from "@/lib/domain/draft-schema";
import { normalizeQuestionDraftInput } from "@/lib/domain/question-service";

export type DraftActor = "agent" | "human";

export class DraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftValidationError";
  }
}

export class DraftRelationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftRelationError";
  }
}

export class DraftNotFoundError extends Error {
  constructor(message = "Draft not found") {
    super(message);
    this.name = "DraftNotFoundError";
  }
}

export class DraftNotUpdatableError extends Error {
  constructor(message = "Draft is not updatable") {
    super(message);
    this.name = "DraftNotUpdatableError";
  }
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
type TransactionClient = Omit<
  PrismaClientSingleton,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
export type DraftDbClient = PrismaClientSingleton | TransactionClient;

const CONTENT_KEYS = [
  "type",
  "stemMd",
  "options",
  "answer",
  "solutionMd",
  "difficulty",
  "knowledgePointIds",
  "tagIds",
  "sourceRawAssetId",
] as const;

const draftDetailInclude = {
  sourceRawAsset: {
    select: {
      id: true,
      kind: true,
      status: true,
      originalName: true,
      mimeType: true,
      textContent: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  suggestions: {
    select: {
      id: true,
      kind: true,
      payload: true,
      confidence: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      knowledgePoint: {
        select: {
          name: true,
          slug: true,
        },
      },
      createdByAgentRun: {
        select: {
          agentName: true,
          toolName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  agentRuns: {
    select: {
      id: true,
      agentName: true,
      toolName: true,
      model: true,
      status: true,
      confidence: true,
      accepted: true,
      input: true,
      output: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} satisfies Prisma.QuestionDraftInclude;

type DraftRecord = Prisma.QuestionDraftGetPayload<Record<string, never>>;
type DraftDetailRecord = Prisma.QuestionDraftGetPayload<{
  include: typeof draftDetailInclude;
}>;

export type QuestionDraftDto = {
  id: string;
  status: DraftStatus;
  type: QuestionType | null;
  stemMd: string | null;
  optionsJson: Prisma.JsonValue | null;
  answerJson: Prisma.JsonValue | null;
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: string[] | null;
  tagIds: string[] | null;
  sourceRawAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  promotedQuestionId: string | null;
};

export type QuestionDraftDetailDto = QuestionDraftDto & {
  aiOutput: Prisma.JsonValue | null;
  sourceRawAsset: {
    id: string;
    kind: RawAssetKind;
    status: RawAssetStatus;
    originalName: string;
    mimeType: string | null;
    textContent: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  suggestions: {
    id: string;
    kind: string;
    payload: Prisma.JsonValue;
    confidence: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    knowledgePoint: { name: string; slug: string } | null;
    createdByAgentRun: { agentName: string; toolName: string | null } | null;
  }[];
  agentRuns: {
    id: string;
    agentName: string;
    toolName: string | null;
    model: string | null;
    status: JobStatus;
    confidence: number | null;
    accepted: boolean | null;
    input: Prisma.JsonValue;
    output: Prisma.JsonValue | null;
    createdAt: string;
  }[];
};

async function getDb(db?: DraftDbClient): Promise<DraftDbClient> {
  if (db) {
    return db;
  }

  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function asIdArray(value: Prisma.JsonValue | null | undefined): string[] | null {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value;
}

export function toQuestionDraftDto(draft: DraftRecord): QuestionDraftDto {
  return {
    id: draft.id,
    status: draft.status,
    type: draft.type,
    stemMd: draft.stemMd,
    optionsJson: draft.optionsJson ?? null,
    answerJson: draft.answerJson ?? null,
    solutionMd: draft.solutionMd,
    difficulty: draft.difficulty,
    knowledgePointIds: asIdArray(draft.knowledgePointIds),
    tagIds: asIdArray(draft.tagIds),
    sourceRawAssetId: draft.sourceRawAssetId,
    createdAt: toIso(draft.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(draft.updatedAt) ?? new Date(0).toISOString(),
    promotedAt: toIso(draft.promotedAt),
    promotedQuestionId: draft.promotedQuestionId,
  };
}

export function toQuestionDraftDetailDto(
  draft: DraftDetailRecord,
): QuestionDraftDetailDto {
  return {
    ...toQuestionDraftDto(draft),
    aiOutput: draft.aiOutput ?? null,
    sourceRawAsset: draft.sourceRawAsset
      ? {
          id: draft.sourceRawAsset.id,
          kind: draft.sourceRawAsset.kind,
          status: draft.sourceRawAsset.status,
          originalName: draft.sourceRawAsset.originalName,
          mimeType: draft.sourceRawAsset.mimeType,
          textContent: draft.sourceRawAsset.textContent,
          metadata: draft.sourceRawAsset.metadata ?? null,
          createdAt: toIso(draft.sourceRawAsset.createdAt) ?? "",
          updatedAt: toIso(draft.sourceRawAsset.updatedAt) ?? "",
        }
      : null,
    suggestions: draft.suggestions.map((suggestion) => ({
      id: suggestion.id,
      kind: suggestion.kind,
      payload: suggestion.payload ?? {},
      confidence: suggestion.confidence,
      status: suggestion.status,
      createdAt: toIso(suggestion.createdAt) ?? "",
      updatedAt: toIso(suggestion.updatedAt) ?? "",
      knowledgePoint: suggestion.knowledgePoint,
      createdByAgentRun: suggestion.createdByAgentRun,
    })),
    agentRuns: draft.agentRuns.map((run) => ({
      id: run.id,
      agentName: run.agentName,
      toolName: run.toolName,
      model: run.model,
      status: run.status,
      confidence: run.confidence,
      accepted: run.accepted,
      input: run.input ?? {},
      output: run.output ?? null,
      createdAt: toIso(run.createdAt) ?? "",
    })),
  };
}

function hasContentUpdates(input: QuestionDraftWriteInput): boolean {
  return CONTENT_KEYS.some((key) => input[key] !== undefined);
}

function assertStatusTransition(
  actor: DraftActor,
  current: DraftStatus,
  next: DraftStatus,
): void {
  if (actor === "agent") {
    if (next !== "NEEDS_REVIEW") {
      throw new DraftValidationError("Invalid draft status");
    }

    if (current !== "DRAFT") {
      throw new DraftValidationError("Invalid draft status");
    }

    return;
  }

  const legal: Record<string, Set<DraftStatus>> = {
    DRAFT: new Set(["NEEDS_REVIEW", "REJECTED"]),
    NEEDS_REVIEW: new Set(["DRAFT", "REJECTED"]),
  };

  if (!legal[current]?.has(next)) {
    throw new DraftValidationError("Invalid draft status");
  }
}

async function assertKnowledgePointsExist(
  db: DraftDbClient,
  ids: string[] | undefined,
): Promise<void> {
  if (!ids?.length) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const found = await db.knowledgePoint.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (found.length !== uniqueIds.length) {
    throw new DraftRelationError("Knowledge point not found");
  }
}

async function assertTagsExist(
  db: DraftDbClient,
  ids: string[] | undefined,
): Promise<void> {
  if (!ids?.length) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
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
  id: string | undefined,
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

async function assertWriteRelations(
  db: DraftDbClient,
  input: QuestionDraftWriteInput,
): Promise<void> {
  await assertKnowledgePointsExist(db, input.knowledgePointIds);
  await assertTagsExist(db, input.tagIds);
  await assertRawAssetExists(db, input.sourceRawAssetId);
}

function buildCreateData(
  input: QuestionDraftWriteInput,
): Prisma.QuestionDraftUncheckedCreateInput {
  return {
    status: "DRAFT",
    type: input.type,
    stemMd: input.stemMd,
    optionsJson: input.options,
    answerJson: input.answer,
    solutionMd: input.solutionMd,
    difficulty: input.difficulty,
    knowledgePointIds: input.knowledgePointIds,
    tagIds: input.tagIds,
    sourceRawAssetId: input.sourceRawAssetId,
  };
}

const UPDATABLE_STATUSES: DraftStatus[] = ["DRAFT", "NEEDS_REVIEW"];

function buildUpdateWhere(
  id: string,
  currentStatus: DraftStatus,
  nextStatus: DraftStatus | undefined,
): Prisma.QuestionDraftWhereInput {
  if (nextStatus && nextStatus !== currentStatus) {
    if (nextStatus === "REJECTED") {
      return { id, status: { in: UPDATABLE_STATUSES } };
    }

    return { id, status: currentStatus };
  }

  return { id, status: { in: UPDATABLE_STATUSES } };
}

function buildUpdateData(
  input: QuestionDraftWriteInput,
  currentStatus: DraftStatus,
): Prisma.QuestionDraftUncheckedUpdateInput {
  const data: Prisma.QuestionDraftUncheckedUpdateInput = {};

  if (input.type !== undefined) {
    data.type = input.type;
  }

  if (input.stemMd !== undefined) {
    data.stemMd = input.stemMd;
  }

  if (input.options !== undefined) {
    data.optionsJson = input.options;
  }

  if (input.answer !== undefined) {
    data.answerJson = input.answer;
  }

  if (input.solutionMd !== undefined) {
    data.solutionMd = input.solutionMd;
  }

  if (input.difficulty !== undefined) {
    data.difficulty = input.difficulty;
  }

  if (input.knowledgePointIds !== undefined) {
    data.knowledgePointIds = input.knowledgePointIds;
  }

  if (input.tagIds !== undefined) {
    data.tagIds = input.tagIds;
  }

  if (input.sourceRawAssetId !== undefined) {
    data.sourceRawAssetId = input.sourceRawAssetId;
  }

  if (input.status !== undefined && input.status !== currentStatus) {
    data.status = input.status;
  }

  return data;
}

export function mapDraftApiError(error: unknown): {
  error: string;
  status: number;
} {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof DraftValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof DraftRelationError) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof DraftNotFoundError) {
    return { error: error.message, status: 404 };
  }

  if (error instanceof DraftNotUpdatableError) {
    return { error: error.message, status: 409 };
  }

  return { error: "Unable to save draft", status: 500 };
}

export async function createQuestionDraft(
  input: QuestionDraftWriteInput,
  options?: { actor?: DraftActor; db?: DraftDbClient },
): Promise<QuestionDraftDto> {
  const db = await getDb(options?.db);
  const normalized =
    input.answer !== undefined || input.options !== undefined
      ? normalizeQuestionDraftInput(input)
      : input;

  await assertWriteRelations(db, normalized);

  const draft = await db.questionDraft.create({
    data: buildCreateData(normalized),
  });

  return toQuestionDraftDto(draft);
}

export async function updateQuestionDraft(
  id: string,
  input: QuestionDraftWriteInput,
  options: { actor: DraftActor; db?: DraftDbClient },
): Promise<QuestionDraftDto> {
  const db = await getDb(options.db);
  const current = await db.questionDraft.findUnique({ where: { id } });

  if (!current) {
    throw new DraftNotFoundError();
  }

  const sameStatus =
    input.status !== undefined && input.status === current.status;
  const contentUpdates = hasContentUpdates(input);

  if (current.status === "PROMOTED" || current.status === "REJECTED") {
    if (sameStatus && !contentUpdates) {
      return toQuestionDraftDto(current);
    }

    throw new DraftNotUpdatableError();
  }

  if (input.status !== undefined && input.status !== current.status) {
    assertStatusTransition(options.actor, current.status, input.status);
  }

  const normalized =
    input.answer !== undefined || input.options !== undefined
      ? normalizeQuestionDraftInput(input)
      : input;

  await assertWriteRelations(db, normalized);

  const data = buildUpdateData(normalized, current.status);

  if (Object.keys(data).length === 0) {
    return toQuestionDraftDto(current);
  }

  const written = await db.questionDraft.updateMany({
    where: buildUpdateWhere(id, current.status, normalized.status),
    data,
  });

  if (written.count === 0) {
    const raced = await db.questionDraft.findUnique({ where: { id } });

    if (!raced) {
      throw new DraftNotFoundError();
    }

    const racedSameStatus =
      input.status !== undefined && input.status === raced.status;

    if (racedSameStatus && !contentUpdates) {
      return toQuestionDraftDto(raced);
    }

    throw new DraftNotUpdatableError();
  }

  const draft = await db.questionDraft.findUnique({ where: { id } });

  if (!draft) {
    throw new DraftNotFoundError();
  }

  return toQuestionDraftDto(draft);
}

export async function getQuestionDraft(
  id: string,
  options?: { db?: DraftDbClient },
): Promise<QuestionDraftDetailDto | null> {
  const db = await getDb(options?.db);
  const draft = await db.questionDraft.findUnique({
    where: { id },
    include: draftDetailInclude,
  });

  if (!draft) {
    return null;
  }

  return toQuestionDraftDetailDto(draft);
}

export async function listQuestionDrafts(options?: {
  db?: DraftDbClient;
}): Promise<QuestionDraftDto[]> {
  const db = await getDb(options?.db);
  const drafts = await db.questionDraft.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return drafts.map(toQuestionDraftDto);
}
