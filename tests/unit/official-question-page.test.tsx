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
  findUnique: vi.fn(),
  listKnowledgePoints: vi.fn(),
  listTags: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    question: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/domain/taxonomy-repository", () => ({
  listKnowledgePoints: mocks.listKnowledgePoints,
  listTags: mocks.listTags,
}));

import OfficialQuestionPage from "@/app/(dashboard)/questions/[id]/page";

describe("OfficialQuestionPage", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.listKnowledgePoints.mockReset();
    mocks.listTags.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form and does not query Prisma without a cookie", async () => {
    setDashboardCookie(false);

    render(
      await OfficialQuestionPage({
        params: Promise.resolve({ id: "question_1" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.listKnowledgePoints).not.toHaveBeenCalled();
    expect(mocks.listTags).not.toHaveBeenCalled();
  });
});
