import { Prisma, type QuestionStatus } from "@prisma/client";

const defaultLimit = 10;
const maxLimit = 50;

const gradeTerms = ["高一", "高二", "高三"] as const;
const chapterTerms = [
  "运动学",
  "力学",
  "牛顿运动定律",
  "电磁感应",
  "电场",
  "磁场",
  "动量",
  "能量",
  "光学",
  "热学",
] as const;
const usageTerms = ["随堂练习", "课后作业", "单元测试", "期中复习", "期末复习"] as const;

const knowledgePointAliases = [
  { pattern: /v[-\s]?t\s*图像/i, value: "v-t 图像" },
  { pattern: /位移/, value: "位移" },
  { pattern: /速度/, value: "速度" },
  { pattern: /加速度/, value: "加速度" },
  { pattern: /牛顿第二定律/, value: "牛顿第二定律" },
  { pattern: /电磁感应/, value: "电磁感应" },
] as const;

export type QuestionSearchUnderstanding = {
  rawQuery: string;
  terms: string[];
  limit: number;
  grade?: string;
  chapter?: string;
  knowledge_points?: string[];
  difficulty?: number[];
  usage?: string[];
  has_image?: boolean;
};

export type QuestionSearchConstraints = {
  limit?: number;
  grade?: string;
  chapter?: string;
  knowledge_points?: string[];
  difficulty?: number[];
  usage?: string[];
  has_image?: boolean;
  status?: QuestionStatus[];
};

export type QuestionSearchResultReason = {
  field: string;
  value: string;
};

export type QuestionSearchQuestion = Prisma.QuestionGetPayload<{
  select: typeof questionSearchSelect;
}>;

export type QuestionSearchResult = {
  question_id: string;
  id: string;
  score: number;
  reason: string;
  reasons: QuestionSearchResultReason[];
  stemMd: string;
  status: QuestionStatus;
  type: string;
};

export type QuestionSearchResultDto = QuestionSearchResult;

export type QuestionSearchResponse = {
  understanding: QuestionSearchUnderstanding;
  results: QuestionSearchResultDto[];
};

export type RawQuestionSearchConstraints = Partial<
  Omit<QuestionSearchConstraints, "status">
> & {
  status?: QuestionStatus | QuestionStatus[] | string | string[];
};

export class SearchRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchRequestValidationError";
  }
}

export class QuestionSearchPersistenceError extends Error {
  constructor(message = "Unable to search questions") {
    super(message);
    this.name = "QuestionSearchPersistenceError";
  }
}

export const questionSearchSelect = {
  id: true,
  publicId: true,
  type: true,
  status: true,
  stemMd: true,
  solutionMd: true,
  difficulty: true,
  primaryKnowledgePoint: {
    select: {
      name: true,
    },
  },
  knowledgePoints: {
    select: {
      knowledgePoint: {
        select: {
          name: true,
        },
      },
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          name: true,
        },
      },
    },
  },
  assets: {
    select: {
      assetId: true,
    },
  },
} satisfies Prisma.QuestionSelect;

const questionStatuses = [
  "REVIEWED",
  "PUBLISHED",
  "DEPRECATED",
] as const satisfies readonly QuestionStatus[];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new SearchRequestValidationError(`${field} must be an array`);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new SearchRequestValidationError(`${field} must contain strings`);
    }

    return item.trim();
  }).filter(Boolean);
}

function assertNumberArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) {
    throw new SearchRequestValidationError(`${field} must be an array`);
  }

  return value.map((item) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new SearchRequestValidationError(`${field} must contain numbers`);
    }

    return Math.trunc(item);
  });
}

function normalizeStatus(value: unknown): QuestionStatus[] {
  const rawStatuses = Array.isArray(value) ? value : [value];

  return rawStatuses.map((status) => {
    if (typeof status !== "string") {
      throw new SearchRequestValidationError("status must contain strings");
    }

    const normalized = status.trim().toUpperCase();

    if (!questionStatuses.includes(normalized as QuestionStatus)) {
      throw new SearchRequestValidationError("status contains an invalid value");
    }

    return normalized as QuestionStatus;
  });
}

export function normalizeQuestionSearchConstraints(
  constraints: unknown = {},
): QuestionSearchConstraints {
  if (!isRecord(constraints)) {
    throw new SearchRequestValidationError("Search constraints must be an object");
  }

  const normalized: QuestionSearchConstraints = {};

  if (constraints.limit !== undefined) {
    if (
      typeof constraints.limit !== "number" ||
      !Number.isFinite(constraints.limit)
    ) {
      throw new SearchRequestValidationError("limit must be a number");
    }

    normalized.limit = clampLimit(constraints.limit);
  }

  for (const field of ["grade", "chapter"] as const) {
    if (constraints[field] !== undefined) {
      if (typeof constraints[field] !== "string") {
        throw new SearchRequestValidationError(`${field} must be a string`);
      }

      const value = constraints[field].trim();

      if (value) {
        normalized[field] = value;
      }
    }
  }

  if (constraints.knowledge_points !== undefined) {
    normalized.knowledge_points = assertStringArray(
      constraints.knowledge_points,
      "knowledge_points",
    );
  }

  if (constraints.difficulty !== undefined) {
    normalized.difficulty = assertNumberArray(
      constraints.difficulty,
      "difficulty",
    );
  }

  if (constraints.usage !== undefined) {
    normalized.usage = assertStringArray(constraints.usage, "usage");
  }

  if (constraints.has_image !== undefined) {
    if (typeof constraints.has_image !== "boolean") {
      throw new SearchRequestValidationError("has_image must be a boolean");
    }

    normalized.has_image = constraints.has_image;
  }

  if (constraints.status !== undefined) {
    const statuses = uniqueStatuses(normalizeStatus(constraints.status));
    normalized.status = statuses.length > 0 ? statuses : ["REVIEWED", "PUBLISHED"];
  } else {
    normalized.status = ["REVIEWED", "PUBLISHED"];
  }

  return normalized;
}

export type QuestionSearchResultWithReasons = QuestionSearchQuestion & {
  reasons: QuestionSearchResultReason[];
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueStatuses(values: QuestionStatus[]): QuestionStatus[] {
  return [...new Set(values)];
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), maxLimit);
}

function extractLimit(query: string): number {
  const match = query.match(/(\d+)\s*道/);

  return match ? clampLimit(Number(match[1])) : defaultLimit;
}

function includesAnyImageIntent(query: string): boolean | undefined {
  if (/(无图|不要图|不带图)/.test(query)) {
    return false;
  }

  if (/(有图|带图|图像|图片|图表|示意图)/.test(query)) {
    return true;
  }

  return undefined;
}

function extractDifficulty(query: string): number[] | undefined {
  if (/(基础|简单|容易|入门)/.test(query)) {
    return [1, 2];
  }

  if (/(中等|普通)/.test(query)) {
    return [3];
  }

  if (/(困难|压轴|提高|拔高)/.test(query)) {
    return [4, 5];
  }

  return undefined;
}

function findFirstTerm(query: string, terms: readonly string[]): string | undefined {
  return terms.find((term) => query.includes(term));
}

function extractKnowledgePoints(query: string): string[] | undefined {
  const points = unique(
    knowledgePointAliases
      .filter(({ pattern }) => pattern.test(query))
      .map(({ value }) => value),
  );

  return points.length > 0 ? points : undefined;
}

function extractUsage(query: string): string[] | undefined {
  const usage = usageTerms.filter((term) => query.includes(term));

  return usage.length > 0 ? usage : undefined;
}

export function understandQuestionSearchQuery(
  query: string,
): QuestionSearchUnderstanding {
  const rawQuery = query.trim().replace(/\s+/g, " ");
  const grade = findFirstTerm(rawQuery, gradeTerms);
  const chapter = findFirstTerm(rawQuery, chapterTerms);
  const knowledgePoints = extractKnowledgePoints(rawQuery);
  const difficulty = extractDifficulty(rawQuery);
  const usage = extractUsage(rawQuery);
  const hasImage = includesAnyImageIntent(rawQuery);
  const terms = unique([
    grade,
    chapter,
    ...(knowledgePoints ?? []),
    ...(usage ?? []),
  ].filter((term): term is string => Boolean(term)));

  return {
    rawQuery,
    terms,
    limit: extractLimit(rawQuery),
    ...(grade ? { grade } : {}),
    ...(chapter ? { chapter } : {}),
    ...(knowledgePoints ? { knowledge_points: knowledgePoints } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(usage ? { usage } : {}),
    ...(hasImage === undefined ? {} : { has_image: hasImage }),
  };
}

function mergeUnderstandingWithConstraints(
  understanding: QuestionSearchUnderstanding,
  constraints: RawQuestionSearchConstraints = {},
): QuestionSearchUnderstanding & QuestionSearchConstraints {
  const normalizedConstraints = normalizeQuestionSearchConstraints(constraints);

  return {
    ...understanding,
    ...normalizedConstraints,
    limit: clampLimit(normalizedConstraints.limit ?? understanding.limit),
    knowledge_points:
      normalizedConstraints.knowledge_points ?? understanding.knowledge_points,
    difficulty: normalizedConstraints.difficulty ?? understanding.difficulty,
    usage: normalizedConstraints.usage ?? understanding.usage,
    has_image: normalizedConstraints.has_image ?? understanding.has_image,
  };
}

function textContains(term: string): Prisma.QuestionWhereInput[] {
  return [
    { stemMd: { contains: term, mode: "insensitive" } },
    { solutionMd: { contains: term, mode: "insensitive" } },
    { publicId: { contains: term, mode: "insensitive" } },
    {
      primaryKnowledgePoint: {
        name: { contains: term, mode: "insensitive" },
      },
    },
    {
      knowledgePoints: {
        some: {
          knowledgePoint: {
            name: { contains: term, mode: "insensitive" },
          },
        },
      },
    },
    {
      tags: {
        some: {
          tag: {
            name: { contains: term, mode: "insensitive" },
          },
        },
      },
    },
  ];
}

function usageContains(usage: string): Prisma.QuestionWhereInput[] {
  return [
    {
      usageJson: {
        path: ["usage"],
        array_contains: usage,
      },
    },
    {
      usageJson: {
        path: ["suggestedUsage"],
        array_contains: usage,
      },
    },
    {
      usageJson: {
        string_contains: usage,
      },
    },
    {
      tags: {
        some: {
          tag: {
            name: { contains: usage, mode: "insensitive" },
          },
        },
      },
    },
  ];
}

export function buildQuestionSearchWhere(
  understanding: QuestionSearchUnderstanding,
  constraints: RawQuestionSearchConstraints = {},
): Prisma.QuestionWhereInput {
  const normalizedConstraints = normalizeQuestionSearchConstraints(constraints);
  const merged = mergeUnderstandingWithConstraints(
    understanding,
    normalizedConstraints,
  );
  const andClauses: Prisma.QuestionWhereInput[] = [];

  if (merged.knowledge_points && merged.knowledge_points.length > 0) {
    andClauses.push({
      OR: merged.knowledge_points.flatMap((term) => textContains(term)),
    });
  }

  for (const term of [merged.grade, merged.chapter].filter(
    (term): term is string => Boolean(term),
  )) {
    andClauses.push({ OR: textContains(term) });
  }

  for (const usage of merged.usage ?? []) {
    andClauses.push({ OR: usageContains(usage) });
  }

  if (andClauses.length === 0 && understanding.rawQuery) {
    andClauses.push({ OR: textContains(understanding.rawQuery) });
  }

  return {
    ...(normalizedConstraints.status && normalizedConstraints.status.length > 0
      ? { status: { in: normalizedConstraints.status } }
      : {}),
    ...(merged.difficulty ? { difficulty: { in: merged.difficulty } } : {}),
    ...(merged.has_image === true ? { assets: { some: {} } } : {}),
    ...(merged.has_image === false ? { assets: { none: {} } } : {}),
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
  };
}

function questionText(question: QuestionSearchQuestion): string {
  return [
    question.publicId,
    question.stemMd,
    question.solutionMd,
    question.primaryKnowledgePoint?.name,
    ...question.knowledgePoints.map((link) => link.knowledgePoint.name),
    ...question.tags.map((link) => link.tag.name),
  ]
    .filter(Boolean)
    .join(" ");
}

export function explainQuestionSearchMatch(
  question: QuestionSearchQuestion,
  understanding: QuestionSearchUnderstanding,
): QuestionSearchResultReason[] {
  const text = questionText(question).toLowerCase();
  const reasons: QuestionSearchResultReason[] = [];

  for (const term of understanding.terms) {
    if (text.includes(term.toLowerCase())) {
      reasons.push({ field: "text", value: term });
    }
  }

  if (
    understanding.difficulty?.includes(question.difficulty ?? -1)
  ) {
    reasons.push({ field: "difficulty", value: String(question.difficulty) });
  }

  if (understanding.has_image === true && question.assets.length > 0) {
    reasons.push({ field: "assets", value: "has_image" });
  }

  return reasons.length > 0
    ? reasons
    : [{ field: "query", value: understanding.rawQuery }];
}

function scoreQuestionSearchResult(
  question: QuestionSearchQuestion,
  reasons: QuestionSearchResultReason[],
): number {
  const reasonScore = reasons.length * 10;
  const difficultyScore = question.difficulty ? Math.max(0, 6 - question.difficulty) : 0;
  const assetScore = question.assets.length > 0 ? 2 : 0;

  return reasonScore + difficultyScore + assetScore;
}

function toQuestionSearchResultDto(
  question: QuestionSearchQuestion,
  understanding: QuestionSearchUnderstanding,
): QuestionSearchResultDto {
  const reasons = explainQuestionSearchMatch(question, understanding);

  return {
    question_id: question.publicId,
    id: question.id,
    score: scoreQuestionSearchResult(question, reasons),
    reason: reasons.map((item) => `${item.field}:${item.value}`).join("; "),
    reasons,
    stemMd: question.stemMd,
    status: question.status,
    type: question.type,
  };
}

export async function searchQuestions(
  query: string,
  constraints: RawQuestionSearchConstraints = {},
): Promise<QuestionSearchResponse> {
  try {
    const normalizedConstraints = normalizeQuestionSearchConstraints(constraints);
    const understanding = understandQuestionSearchQuery(query);
    const merged = mergeUnderstandingWithConstraints(
      understanding,
      normalizedConstraints,
    );
    const where = buildQuestionSearchWhere(understanding, normalizedConstraints);
    const { prisma } = await import("@/lib/db/prisma");
    const questions = await prisma.question.findMany({
      where,
      select: questionSearchSelect,
      orderBy: {
        createdAt: "desc",
      },
      take: merged.limit,
    });

    return {
      understanding: {
        ...understanding,
        limit: merged.limit,
        ...(merged.grade ? { grade: merged.grade } : {}),
        ...(merged.chapter ? { chapter: merged.chapter } : {}),
        ...(merged.knowledge_points
          ? { knowledge_points: merged.knowledge_points }
          : {}),
        ...(merged.difficulty ? { difficulty: merged.difficulty } : {}),
        ...(merged.usage ? { usage: merged.usage } : {}),
        ...(merged.has_image === undefined
          ? {}
          : { has_image: merged.has_image }),
      },
      results: questions.map((question) =>
        toQuestionSearchResultDto(question, understanding),
      ),
    };
  } catch (error) {
    if (error instanceof SearchRequestValidationError) {
      throw error;
    }

    throw new QuestionSearchPersistenceError();
  }
}
