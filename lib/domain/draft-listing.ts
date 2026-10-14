import type { DraftStatus, Prisma, PrismaClient } from "@prisma/client";

export const UNPROMOTED_DRAFT_STATUSES = [
  "DRAFT",
  "NEEDS_REVIEW",
  "REJECTED",
] as const satisfies readonly DraftStatus[];

export type UnpromotedDraftStatus = (typeof UNPROMOTED_DRAFT_STATUSES)[number];

export const UNPROMOTED_PAGE_SIZE = 50;

export const unpromotedDraftSelect = {
  id: true,
  status: true,
  stemMd: true,
  updatedAt: true,
  knowledgePointIds: true,
  agentRuns: {
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.QuestionDraftSelect;

export type UnpromotedDraft = Prisma.QuestionDraftGetPayload<{
  select: typeof unpromotedDraftSelect;
}>;

export type UnpromotedDraftCounts = {
  NEEDS_REVIEW: number;
  DRAFT: number;
  REJECTED: number;
};

type DraftListingDb = {
  questionDraft: Pick<PrismaClient["questionDraft"], "findMany" | "groupBy">;
};

export function parseUnpromotedDraftStatus(
  value: string | undefined,
): UnpromotedDraftStatus {
  return value === "DRAFT" || value === "REJECTED" ? value : "NEEDS_REVIEW";
}

export function parseUnpromotedDraftPage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export async function listUnpromotedDrafts(
  db: DraftListingDb,
  status: UnpromotedDraftStatus,
  {
    take = UNPROMOTED_PAGE_SIZE,
    page = 1,
  }: {
    take?: number;
    page?: number;
  } = {},
): Promise<UnpromotedDraft[]> {
  const safePage = page < 1 ? 1 : page;

  return db.questionDraft.findMany({
    select: unpromotedDraftSelect,
    where: { status },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    skip: (safePage - 1) * take,
  });
}

export async function countUnpromotedDraftsByStatus(
  db: DraftListingDb,
): Promise<UnpromotedDraftCounts> {
  const groups = await db.questionDraft.groupBy({
    by: ["status"],
    where: { status: { in: [...UNPROMOTED_DRAFT_STATUSES] } },
    _count: { _all: true },
  });

  const counts: UnpromotedDraftCounts = {
    NEEDS_REVIEW: 0,
    DRAFT: 0,
    REJECTED: 0,
  };

  for (const group of groups) {
    if (
      group.status === "NEEDS_REVIEW" ||
      group.status === "DRAFT" ||
      group.status === "REJECTED"
    ) {
      counts[group.status] = group._count._all;
    }
  }

  return counts;
}
