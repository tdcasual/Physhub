import type { Prisma } from "@prisma/client";

export const knowledgePointOrderBy = [
  { sortOrder: "asc" },
  { name: "asc" },
] satisfies Prisma.KnowledgePointOrderByWithRelationInput[];

export const tagOrderBy = [
  { group: { sort: "asc", nulls: "last" } },
  { name: "asc" },
] satisfies Prisma.TagOrderByWithRelationInput[];

export type KnowledgePointListItem = Prisma.KnowledgePointGetPayload<object>;
export type TagListItem = Prisma.TagGetPayload<object>;

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;

async function getDb(): Promise<PrismaClientSingleton> {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

export function buildKnowledgePointsResponse<T>(knowledgePoints: T[]) {
  return { knowledgePoints };
}

export function buildTagsResponse<T>(tags: T[]) {
  return { tags };
}

export async function listKnowledgePoints(): Promise<KnowledgePointListItem[]> {
  const db = await getDb();

  return db.knowledgePoint.findMany({
    orderBy: knowledgePointOrderBy,
  });
}

export async function listTags(): Promise<TagListItem[]> {
  const db = await getDb();

  return db.tag.findMany({
    orderBy: tagOrderBy,
  });
}
