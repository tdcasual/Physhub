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

vi.mock("@/components/question/question-editor", () => ({
  QuestionEditor: () => <section>Manual Question Editor</section>,
}));

import NewQuestionPage from "@/app/(dashboard)/questions/new/page";

describe("NewQuestionPage", () => {
  beforeEach(() => {
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
    mocks.listKnowledgePoints.mockReset();
    mocks.listTags.mockReset();
    mocks.listKnowledgePoints.mockResolvedValue([]);
    mocks.listTags.mockResolvedValue([]);
  });

  it("renders unlock form without a session cookie", async () => {
    setDashboardCookie(false);

    render(await NewQuestionPage());

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(screen.queryByText("Manual Question Editor")).not.toBeInTheDocument();
    expect(mocks.listKnowledgePoints).not.toHaveBeenCalled();
    expect(mocks.listTags).not.toHaveBeenCalled();
  });

  it("renders the editor after a valid session cookie", async () => {
    render(await NewQuestionPage());

    expect(screen.getByText("Manual Question Editor")).toBeInTheDocument();
    expect(mocks.listKnowledgePoints).toHaveBeenCalled();
    expect(mocks.listTags).toHaveBeenCalled();
  });
});
