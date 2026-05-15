import type { Prisma } from "@prisma/client";

export const knowledgePointSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  sortOrder: true,
} satisfies Prisma.KnowledgePointSelect;

export const knowledgePointOrderBy = [
  { sortOrder: "asc" },
  { name: "asc" },
] satisfies Prisma.KnowledgePointOrderByWithRelationInput[];

export const tagSelect = {
  id: true,
  name: true,
  slug: true,
  group: true,
} satisfies Prisma.TagSelect;

export const tagOrderBy = [
  { group: { sort: "asc", nulls: "last" } },
  { name: "asc" },
] satisfies Prisma.TagOrderByWithRelationInput[];

export type KnowledgePointDto = Prisma.KnowledgePointGetPayload<{
  select: typeof knowledgePointSelect;
}>;

export type TagDto = Prisma.TagGetPayload<{
  select: typeof tagSelect;
}>;

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
type KnowledgePointFindManyArgs = {
  select: typeof knowledgePointSelect;
  orderBy: typeof knowledgePointOrderBy;
};

type TagFindManyArgs = {
  select: typeof tagSelect;
  orderBy: typeof tagOrderBy;
};

type KnowledgePointListClient = {
  knowledgePoint: {
    findMany(args: KnowledgePointFindManyArgs): Promise<KnowledgePointDto[]>;
  };
};

type TagListClient = {
  tag: {
    findMany(args: TagFindManyArgs): Promise<TagDto[]>;
  };
};

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

export async function listKnowledgePointsWithClient(
  db: KnowledgePointListClient,
): Promise<KnowledgePointDto[]> {
  return db.knowledgePoint.findMany({
    select: knowledgePointSelect,
    orderBy: knowledgePointOrderBy,
  });
}

export async function listKnowledgePoints(): Promise<KnowledgePointDto[]> {
  const db = await getDb();

  return listKnowledgePointsWithClient(db);
}

export async function listTagsWithClient(
  db: TagListClient,
): Promise<TagDto[]> {
  return db.tag.findMany({
    select: tagSelect,
    orderBy: tagOrderBy,
  });
}

export async function listTags(): Promise<TagDto[]> {
  const db = await getDb();

  return listTagsWithClient(db);
}
