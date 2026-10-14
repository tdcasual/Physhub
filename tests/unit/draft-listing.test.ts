import { describe, expect, it, vi } from "vitest";

import {
  UNPROMOTED_PAGE_SIZE,
  countUnpromotedDraftsByStatus,
  listUnpromotedDrafts,
  parseUnpromotedDraftPage,
  parseUnpromotedDraftStatus,
} from "@/lib/domain/draft-listing";

function draftRow(id: string, status: "DRAFT" | "NEEDS_REVIEW" | "REJECTED") {
  return {
    id,
    status,
    stemMd: id,
    updatedAt: new Date(`2026-05-01T00:00:00.000Z`),
    knowledgePointIds: [],
    agentRuns: [],
  };
}

describe("draft listing", () => {
  it("parses status and page", () => {
    expect(parseUnpromotedDraftStatus(undefined)).toBe("NEEDS_REVIEW");
    expect(parseUnpromotedDraftStatus("DRAFT")).toBe("DRAFT");
    expect(parseUnpromotedDraftPage("2")).toBe(2);
    expect(parseUnpromotedDraftPage("0")).toBe(1);
  });

  it("returns a NEEDS_REVIEW draft that sits behind 51 DRAFT rows", async () => {
    const findMany = vi.fn().mockResolvedValue([draftRow("nr_1", "NEEDS_REVIEW")]);
    const groupBy = vi.fn();

    const rows = await listUnpromotedDrafts(
      { questionDraft: { findMany, groupBy } },
      "NEEDS_REVIEW",
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "NEEDS_REVIEW" },
        take: UNPROMOTED_PAGE_SIZE,
        skip: 0,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(rows).toEqual([expect.objectContaining({ id: "nr_1" })]);
  });

  it("reaches the 51st same-status draft on page 2 and reports global counts", async () => {
    const findMany = vi.fn().mockImplementation(async ({ skip, take }) => {
      const ids = Array.from({ length: 51 }, (_, index) =>
        draftRow(`nr_${String(51 - index).padStart(2, "0")}`, "NEEDS_REVIEW"),
      );
      return ids.slice(skip, skip + take);
    });
    const groupBy = vi.fn().mockResolvedValue([
      { status: "NEEDS_REVIEW", _count: { _all: 51 } },
      { status: "DRAFT", _count: { _all: 0 } },
      { status: "REJECTED", _count: { _all: 0 } },
    ]);
    const db = { questionDraft: { findMany, groupBy } };

    const page1 = await listUnpromotedDrafts(db, "NEEDS_REVIEW", { page: 1 });
    const page2 = await listUnpromotedDrafts(db, "NEEDS_REVIEW", { page: 2 });
    const counts = await countUnpromotedDraftsByStatus(db);

    expect(page1).toHaveLength(50);
    expect(page2).toEqual([expect.objectContaining({ id: "nr_01" })]);
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 50, take: 50, where: { status: "NEEDS_REVIEW" } }),
    );
    expect(counts.NEEDS_REVIEW).toBe(51);
  });
});
