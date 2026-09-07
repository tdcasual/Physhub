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
  listKnowledgePoints: vi.fn(),
  listTags: vi.fn(),
}));

vi.mock("@/lib/domain/taxonomy-repository", () => ({
  listKnowledgePoints: mocks.listKnowledgePoints,
  listTags: mocks.listTags,
}));

import TaxonomyPage from "@/app/(dashboard)/taxonomy/page";

describe("TaxonomyPage", () => {
  beforeEach(() => {
    mocks.listKnowledgePoints.mockReset();
    mocks.listTags.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form and does not list taxonomy without a cookie", async () => {
    setDashboardCookie(false);

    render(await TaxonomyPage());

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(mocks.listKnowledgePoints).not.toHaveBeenCalled();
    expect(mocks.listTags).not.toHaveBeenCalled();
  });
});
