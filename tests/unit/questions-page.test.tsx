import { render, screen } from "@testing-library/react";
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
    question: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/components/search/question-search-panel", () => ({
  QuestionSearchPanel: () => <section>Search panel</section>,
}));

import QuestionsPage from "@/app/(dashboard)/questions/page";

describe("QuestionsPage", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form and does not query Prisma without a session cookie", async () => {
    setDashboardCookie(false);

    render(await QuestionsPage());

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Questions" })).not.toBeInTheDocument();
  });

  it("lists only reviewed and published questions by default", async () => {
    mocks.findMany.mockResolvedValueOnce([
      {
        id: "question_1",
        publicId: "q_motion_0001",
        type: "SINGLE_CHOICE",
        status: "REVIEWED",
        stemMd: "Reviewed stem",
        difficulty: 2,
        updatedAt: new Date("2026-05-15T08:00:00.000Z"),
        primaryKnowledgePoint: { name: "运动学" },
        tags: [],
      },
    ]);

    render(await QuestionsPage());

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: {
            in: ["REVIEWED", "PUBLISHED"],
          },
        },
        take: 50,
      }),
    );
    expect(
      screen.getByRole("heading", { name: "q_motion_0001" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "href",
      "/drafts",
    );
    expect(screen.getByRole("link", { name: "New draft" })).toHaveAttribute(
      "href",
      "/questions/new",
    );
  });
});
