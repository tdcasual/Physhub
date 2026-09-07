import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DraftsPage from "@/app/(dashboard)/drafts/page";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    questionDraft: {
      findMany: mocks.findMany,
    },
  },
}));

describe("DraftsPage", () => {
  it("lists unpromoted drafts with status, updated time, and truncated stem", async () => {
    const longStem = `${"如图所示为某物体做直线运动的 v-t 图像。".repeat(8)} extra`;

    mocks.findMany.mockResolvedValueOnce([
      {
        id: "draft_1",
        status: "NEEDS_REVIEW",
        stemMd: longStem,
        updatedAt: new Date("2026-05-15T08:00:00.000Z"),
      },
      {
        id: "draft_2",
        status: "DRAFT",
        stemMd: null,
        updatedAt: new Date("2026-05-14T08:00:00.000Z"),
      },
    ]);

    render(await DraftsPage());

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: ["DRAFT", "NEEDS_REVIEW", "REJECTED"],
          },
        },
        take: 50,
      }),
    );

    const truncatedLink = screen.getByRole("link", {
      name: /如图所示为某物体做直线运动的 v-t 图像/,
    });
    expect(truncatedLink).toHaveAttribute("href", "/drafts/draft_1");
    expect(truncatedLink.textContent?.endsWith("…")).toBe(true);
    expect(truncatedLink.textContent?.length).toBeLessThanOrEqual(121);
    expect(screen.getByText("NEEDS_REVIEW")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Untitled draft" })).toHaveAttribute(
      "href",
      "/drafts/draft_2",
    );
    expect(screen.getAllByText(/Updated /)).toHaveLength(2);
  });

  it("renders an empty state when there are no unpromoted drafts", async () => {
    mocks.findMany.mockResolvedValueOnce([]);

    render(await DraftsPage());

    expect(screen.getByText("No unpromoted drafts.")).toBeInTheDocument();
  });
});
