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
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    questionDraft: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/components/draft/draft-review-workspace", () => ({
  DraftReviewWorkspace: ({
    draft,
  }: {
    draft: { answerJson: unknown; solutionMd: string | null };
  }) => (
    <section>
      <p>workspace answer {JSON.stringify(draft.answerJson)}</p>
      <p>workspace solution {draft.solutionMd}</p>
    </section>
  ),
}));

import DraftReviewPage from "@/app/(dashboard)/drafts/[id]/page";

describe("DraftReviewPage", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form and does not query Prisma or serialize answers without a cookie", async () => {
    setDashboardCookie(false);

    render(await DraftReviewPage({ params: Promise.resolve({ id: "draft_1" }) }));

    expect(screen.getByRole("heading", { name: "Unlock editor" })).toBeInTheDocument();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(screen.queryByText(/workspace answer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-answer/)).not.toBeInTheDocument();
  });

  it("loads the draft after a valid session cookie", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "draft_1",
      status: "DRAFT",
      type: "SINGLE_CHOICE",
      stemMd: "stem",
      optionsJson: [{ label: "A", value: "x" }],
      answerJson: { type: "single", value: "A" },
      solutionMd: "secret-answer",
      aiOutput: null,
      createdAt: new Date("2026-05-15T08:00:00.000Z"),
      updatedAt: new Date("2026-05-15T08:00:00.000Z"),
      promotedAt: null,
      promotedQuestionId: null,
      sourceRawAsset: null,
      suggestions: [],
      agentRuns: [],
    });

    render(await DraftReviewPage({ params: Promise.resolve({ id: "draft_1" }) }));

    expect(mocks.findUnique).toHaveBeenCalled();
    expect(screen.getByText(/workspace solution secret-answer/)).toBeInTheDocument();
  });
});
