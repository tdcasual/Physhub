import type { Prisma } from "@prisma/client";

export type SuggestionWriteActor = "agent" | "human";

export type SuggestionWritePolicyInput = {
  actor: SuggestionWriteActor;
  kind: string;
};

export class SuggestionPayloadError extends Error {
  constructor(message = "Suggestion payload missing knowledge point id") {
    super(message);
    this.name = "SuggestionPayloadError";
  }
}

export class SuggestionRelationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionRelationError";
  }
}

export class SuggestionClosedError extends Error {
  constructor(message = "Suggestions cannot be applied to a closed draft") {
    super(message);
    this.name = "SuggestionClosedError";
  }
}

export function canSuggestionWriteDirectlyToQuestion(
  input: SuggestionWritePolicyInput,
) {
  return input.actor === "human";
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
type TransactionClient = Omit<
  PrismaClientSingleton,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
export type SuggestionDbClient = PrismaClientSingleton | TransactionClient;

export type MetadataSuggestionApplyPlan = {
  knowledgePointIds?: string[];
  difficulty?: number | null;
  tagIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function knowledgePointIdFromItem(item: unknown): string | null {
  if (!isRecord(item)) {
    return null;
  }

  if (typeof item.id !== "string" || item.id.trim() === "") {
    return null;
  }

  return item.id.trim();
}

export function suggestionPayloadMissingKnowledgePointId(
  payload: unknown,
): boolean {
  if (!isRecord(payload) || !("knowledge_points" in payload)) {
    return false;
  }

  const value = payload.knowledge_points;

  if (value == null) {
    return false;
  }

  if (!Array.isArray(value)) {
    return true;
  }

  return value.some((item) => knowledgePointIdFromItem(item) == null);
}

function parseKnowledgePointIds(payload: Record<string, unknown>): string[] | undefined {
  if (!("knowledge_points" in payload)) {
    return undefined;
  }

  const value = payload.knowledge_points;

  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new SuggestionPayloadError();
  }

  return value.map((item) => {
    const id = knowledgePointIdFromItem(item);

    if (id == null) {
      throw new SuggestionPayloadError();
    }

    return id;
  });
}

function parseDifficulty(payload: Record<string, unknown>): number | null | undefined {
  if (!("difficulty" in payload)) {
    return undefined;
  }

  const value = payload.difficulty;

  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return clampDifficulty(value);
  }

  if (isRecord(value)) {
    if (!("value" in value) || value.value == null) {
      return value.value === null ? null : undefined;
    }

    if (typeof value.value === "number") {
      return clampDifficulty(value.value);
    }
  }

  return undefined;
}

function clampDifficulty(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new SuggestionPayloadError("Invalid difficulty");
  }

  return value;
}

function parseTagIds(payload: Record<string, unknown>): string[] | undefined {
  if (!("tag_ids" in payload)) {
    return undefined;
  }

  const value = payload.tag_ids;

  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new SuggestionRelationError("Tag not found");
  }

  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new SuggestionRelationError("Tag not found");
    }

    return item.trim();
  });
}

export function parseMetadataSuggestionPayload(
  payload: unknown,
): MetadataSuggestionApplyPlan {
  if (!isRecord(payload)) {
    return {};
  }

  return {
    knowledgePointIds: parseKnowledgePointIds(payload),
    difficulty: parseDifficulty(payload),
    tagIds: parseTagIds(payload),
  };
}

async function assertKnowledgePointsExist(
  db: SuggestionDbClient,
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
    throw new SuggestionRelationError("Knowledge point not found");
  }
}

async function assertTagsExist(
  db: SuggestionDbClient,
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
    throw new SuggestionRelationError("Tag not found");
  }
}

async function applyToQuestion(
  db: SuggestionDbClient,
  questionId: string,
  plan: MetadataSuggestionApplyPlan,
  actorId?: string,
): Promise<void> {
  const data: Prisma.QuestionUncheckedUpdateInput = {};
  const replaceKnowledgePoints =
    plan.knowledgePointIds !== undefined && plan.knowledgePointIds.length > 0;

  if (replaceKnowledgePoints && plan.knowledgePointIds) {
    await db.questionKnowledgePoint.deleteMany({ where: { questionId } });
    await db.questionKnowledgePoint.createMany({
      data: plan.knowledgePointIds.map((knowledgePointId, index) => ({
        questionId,
        knowledgePointId,
        role: index === 0 ? "primary" : "secondary",
      })),
    });
    data.primaryKnowledgePointId = plan.knowledgePointIds[0];
  }

  if (plan.difficulty !== undefined) {
    data.difficulty = plan.difficulty;
  }

  const mutated =
    Object.keys(data).length > 0 || plan.tagIds !== undefined;

  if (Object.keys(data).length > 0) {
    await db.question.update({
      where: { id: questionId },
      data,
    });
  }

  if (plan.tagIds !== undefined) {
    await db.questionTag.deleteMany({ where: { questionId } });

    if (plan.tagIds.length > 0) {
      await db.questionTag.createMany({
        data: plan.tagIds.map((tagId) => ({ questionId, tagId })),
      });
    }
  }

  if (!mutated) {
    return;
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: {
      knowledgePoints: true,
      tags: true,
      versions: {
        select: { version: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!question) {
    return;
  }

  const knowledgePointIds = question.knowledgePoints.map(
    (link) => link.knowledgePointId,
  );
  const tagIds = question.tags.map((link) => link.tagId);
  const version = (question.versions[0]?.version ?? 0) + 1;

  await db.questionVersion.create({
    data: {
      questionId,
      version,
      snapshot: {
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
        hasRenderedImage: question.hasRenderedImage,
        publishedAt: question.publishedAt?.toISOString() ?? null,
        knowledgePointIds,
        tagIds,
        updatedAt: question.updatedAt.toISOString(),
      },
      createdById: actorId,
    },
  });
}

async function applyToDraft(
  db: SuggestionDbClient,
  draftId: string,
  plan: MetadataSuggestionApplyPlan,
): Promise<void> {
  const data: Prisma.QuestionDraftUncheckedUpdateInput = {};

  if (plan.knowledgePointIds !== undefined) {
    data.knowledgePointIds = plan.knowledgePointIds;
  }

  if (plan.difficulty !== undefined) {
    data.difficulty = plan.difficulty;
  }

  if (plan.tagIds !== undefined) {
    data.tagIds = plan.tagIds;
  }

  if (Object.keys(data).length === 0) {
    return;
  }

  await db.questionDraft.update({
    where: { id: draftId },
    data,
  });
}

export async function applyAcceptedMetadataSuggestion(
  db: SuggestionDbClient,
  suggestion: {
    kind: string;
    payload: unknown;
    questionId: string | null;
    draftId: string | null;
  },
  actor: SuggestionWriteActor = "human",
  actorId?: string,
): Promise<void> {
  if (
    !canSuggestionWriteDirectlyToQuestion({
      actor,
      kind: suggestion.kind,
    })
  ) {
    return;
  }

  if (suggestion.kind !== "metadata") {
    return;
  }

  const plan = parseMetadataSuggestionPayload(suggestion.payload);

  await assertKnowledgePointsExist(db, plan.knowledgePointIds);
  await assertTagsExist(db, plan.tagIds);

  if (suggestion.draftId) {
    const draft = await db.questionDraft.findUnique({
      where: { id: suggestion.draftId },
      select: { status: true },
    });

    if (
      !draft ||
      draft.status === "PROMOTED" ||
      draft.status === "REJECTED"
    ) {
      throw new SuggestionClosedError();
    }

    await applyToDraft(db, suggestion.draftId, plan);
    return;
  }

  if (suggestion.questionId) {
    await applyToQuestion(db, suggestion.questionId, plan, actorId);
  }
}
