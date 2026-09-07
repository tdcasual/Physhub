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
    return value;
  }

  if (isRecord(value)) {
    if (!("value" in value) || value.value == null) {
      return value.value === null ? null : undefined;
    }

    if (typeof value.value === "number") {
      return value.value;
    }
  }

  return undefined;
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
): Promise<void> {
  const data: Prisma.QuestionUncheckedUpdateInput = {};

  if (plan.knowledgePointIds !== undefined) {
    await db.questionKnowledgePoint.deleteMany({ where: { questionId } });

    if (plan.knowledgePointIds.length > 0) {
      await db.questionKnowledgePoint.createMany({
        data: plan.knowledgePointIds.map((knowledgePointId, index) => ({
          questionId,
          knowledgePointId,
          role: index === 0 ? "primary" : "secondary",
        })),
      });
      data.primaryKnowledgePointId = plan.knowledgePointIds[0];
    } else {
      data.primaryKnowledgePointId = null;
    }
  }

  if (plan.difficulty !== undefined) {
    data.difficulty = plan.difficulty;
  }

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

  if (suggestion.questionId) {
    await applyToQuestion(db, suggestion.questionId, plan);
    return;
  }

  if (suggestion.draftId) {
    await applyToDraft(db, suggestion.draftId, plan);
  }
}
