import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dashboardCookieStore,
  setDashboardCookie,
} from "@/tests/unit/helpers/dashboard-cookies";

vi.mock("next/headers", () => ({
  cookies: async () => dashboardCookieStore,
}));

vi.mock("@/components/question/question-editor", () => ({
  QuestionEditor: () => <section>Manual Question Editor</section>,
}));

import NewQuestionPage from "@/app/(dashboard)/questions/new/page";

describe("NewQuestionPage", () => {
  beforeEach(() => {
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form without a session cookie", async () => {
    setDashboardCookie(false);

    render(await NewQuestionPage());

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(screen.queryByText("Manual Question Editor")).not.toBeInTheDocument();
  });

  it("renders the editor after a valid session cookie", async () => {
    render(await NewQuestionPage());

    expect(screen.getByText("Manual Question Editor")).toBeInTheDocument();
  });
});
