import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dashboardCookieStore,
  setDashboardCookie,
} from "@/tests/unit/helpers/dashboard-cookies";

vi.mock("next/headers", () => ({
  cookies: async () => dashboardCookieStore,
}));

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

import DraftsPage from "@/app/(dashboard)/drafts/page";

describe("DraftsPage", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form and does not query Prisma without a session cookie", async () => {
    setDashboardCookie(false);

    render(await DraftsPage());

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(screen.queryByText("暂无待审稿")).not.toBeInTheDocument();
  });

  it("lists unpromoted drafts with status, updated time, and truncated stem", async () => {
    const longStem = `${"如图所示为某物体做直线运动的 v-t 图像。".repeat(8)} extra`;

    mocks.findMany.mockResolvedValue([
      {
        id: "draft_1",
        status: "NEEDS_REVIEW",
        stemMd: longStem,
        updatedAt: new Date("2026-05-15T08:00:00.000Z"),
        agentRuns: [{ id: "run_1" }],
      },
      {
        id: "draft_2",
        status: "DRAFT",
        stemMd: null,
        updatedAt: new Date("2026-05-14T08:00:00.000Z"),
        agentRuns: [],
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
    expect(screen.getAllByText("待审").length).toBeGreaterThan(0);
    expect(screen.getByText(/来自 agent/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "未写题干" })).not.toBeInTheDocument();

    cleanup();
    render(await DraftsPage({ searchParams: Promise.resolve({ status: "DRAFT" }) }));
    expect(screen.getByRole("link", { name: "未写题干" })).toHaveAttribute(
      "href",
      "/drafts/draft_2",
    );
  });

  it("renders an empty state when there are no unpromoted drafts", async () => {
    mocks.findMany.mockResolvedValueOnce([]);

    render(await DraftsPage());

    expect(screen.getByText("暂无待审稿")).toBeInTheDocument();
  });
});
