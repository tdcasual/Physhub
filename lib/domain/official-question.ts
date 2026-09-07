import { Prisma, type QuestionStatus } from "@prisma/client";

import {
  buildPersistedQuestionContract,
  parseAndValidateQuestionInput,
  QuestionPersistenceError,
  QuestionRelationError,
  QuestionValidationError,
} from "@/lib/domain/question-repository";
import type { QuestionInput } from "@/lib/domain/question-schema";

export class QuestionNotFoundError extends Error {
  constructor(message = "Question not found") {
    super(message);
    this.name = "QuestionNotFoundError";
  }
}

export class QuestionStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionStatusError";
  }
}

const officialQuestionInclude = {
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
  versions: {
    select: { version: true },
    orderBy: { version: "desc" },
    take: 1,
  },
} satisfies Prisma.QuestionInclude;

type OfficialQuestion = Prisma.QuestionGetPayload<{
  include: typeof officialQuestionInclude;
}>;

type OfficialQuestionDb = typeof import("@/lib/db/prisma").prisma;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function assertIdsExist(
  found: Array<{ id: string }>,
  ids: string[],
  message: string,
) {
  const uniqueIds = [...new Set(ids)];

  if (uniqueIds.length === 0) {
    return;
  }

  if (found.length !== uniqueIds.length) {
    throw new QuestionRelationError(message);
  }
}

function buildSnapshot(
  question: OfficialQuestion,
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
    knowledgePointIds,
    tagIds,
    updatedAt: question.updatedAt.toISOString(),
  };
}

async function nextVersion(question: OfficialQuestion): Promise<number> {
  const latest = question.versions[0]?.version ?? 0;

  return latest + 1;
}

export async function updateOfficialQuestionContent(
  id: string,
  rawInput: unknown,
  actorId: string,
  db: OfficialQuestionDb,
): Promise<{ question: OfficialQuestion; version: number }> {
  const input = parseAndValidateQuestionInput(rawInput);
  const body = isRecord(rawInput) ? rawInput : {};
  const tagIdsProvided = "tagIds" in body;
  const difficultyProvided = "difficulty" in body;
  const solutionProvided = "solutionMd" in body;

  return db.$transaction(async (tx) => {
    const existing = await tx.question.findUnique({
      where: { id },
      include: officialQuestionInclude,
    });

    if (!existing) {
      throw new QuestionNotFoundError();
    }

    const tagIds = tagIdsProvided
      ? asIdArray(body.tagIds)
      : existing.tags.map((link) => link.tagId);

    await assertIdsExist(
      await tx.knowledgePoint.findMany({
        where: { id: { in: input.knowledgePointIds } },
        select: { id: true },
      }),
      input.knowledgePointIds,
      "Knowledge point not found",
    );
    await assertIdsExist(
      await tx.tag.findMany({
        where: { id: { in: tagIds } },
        select: { id: true },
      }),
      tagIds,
      "Tag not found",
    );

    const persisted = buildPersistedQuestionContract(input);
    const difficulty = difficultyProvided
      ? (input.difficulty ?? null)
      : existing.difficulty;
    const solutionMd = solutionProvided
      ? (input.solutionMd ?? null)
      : existing.solutionMd;
    const version = await nextVersion(existing);

    await tx.questionKnowledgePoint.deleteMany({ where: { questionId: id } });

    if (tagIdsProvided) {
      await tx.questionTag.deleteMany({ where: { questionId: id } });
    }

    const question = await tx.question.update({
      where: { id },
      data: {
        type: persisted.type,
        stemMd: persisted.stemMd,
        optionsJson: persisted.optionsJson,
        answerJson: persisted.answerJson,
        solutionMd,
        difficulty,
        primaryKnowledgePointId: persisted.primaryKnowledgePointId,
        knowledgePoints: {
          create: input.knowledgePointIds.map((knowledgePointId, index) => ({
            knowledgePointId,
            role: index === 0 ? "primary" : "secondary",
          })),
        },
        ...(tagIdsProvided && tagIds.length > 0
          ? {
              tags: {
                create: tagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
      include: officialQuestionInclude,
    });

    await tx.questionVersion.create({
      data: {
        questionId: id,
        version,
        snapshot: buildSnapshot(question, input.knowledgePointIds, tagIds),
        createdById: actorId,
      },
    });

    return { question, version };
  });
}

export async function updateOfficialQuestionStatus(
  id: string,
  status: QuestionStatus,
  actorId: string,
  db: OfficialQuestionDb,
): Promise<{ question: OfficialQuestion; version: number }> {
  if (status !== "PUBLISHED" && status !== "DEPRECATED") {
    throw new QuestionValidationError("status must be PUBLISHED or DEPRECATED");
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.question.findUnique({
      where: { id },
      include: officialQuestionInclude,
    });

    if (!existing) {
      throw new QuestionNotFoundError();
    }

    if (status === "PUBLISHED" && existing.status !== "REVIEWED") {
      throw new QuestionStatusError("Only REVIEWED questions can be published");
    }

    if (status === "DEPRECATED" && existing.status === "DEPRECATED") {
      throw new QuestionStatusError("Question is already deprecated");
    }

    const version = await nextVersion(existing);
    const question = await tx.question.update({
      where: { id },
      data: {
        status,
        ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
      include: officialQuestionInclude,
    });

    const knowledgePointIds = question.knowledgePoints.map(
      (link) => link.knowledgePointId,
    );
    const tagIds = question.tags.map((link) => link.tagId);

    await tx.questionVersion.create({
      data: {
        questionId: id,
        version,
        snapshot: buildSnapshot(question, knowledgePointIds, tagIds),
        createdById: actorId,
      },
    });

    return { question, version };
  });
}

export function mapOfficialQuestionApiError(error: unknown): {
  error: string;
  status: 400 | 404 | 409 | 422 | 500;
} {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof QuestionValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof QuestionNotFoundError) {
    return { error: error.message, status: 404 };
  }

  if (error instanceof QuestionStatusError) {
    return { error: error.message, status: 409 };
  }

  if (error instanceof QuestionRelationError) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof QuestionPersistenceError) {
    return { error: error.message, status: 500 };
  }

  return { error: "Unable to update question", status: 500 };
}

export type { QuestionInput };
