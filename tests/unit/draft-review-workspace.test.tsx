import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DraftReviewWorkspace,
  type DraftReviewWorkspaceDraft,
} from "@/components/draft/draft-review-workspace";

const draft: DraftReviewWorkspaceDraft = {
  id: "draft_1",
  status: "NEEDS_REVIEW",
  type: "SINGLE_CHOICE",
  stemMd: "A cart moves with acceleration $a$.",
  optionsJson: [
    { label: "A", value: "Speed is constant" },
    { label: "B", value: "Velocity changes uniformly" },
  ],
  answerJson: { type: "single", value: "B" },
  solutionMd: "Acceleration changes velocity, so choose B.",
  aiOutput: { source: "mock parser" },
  createdAt: "2026-05-16T10:00:00.000Z",
  updatedAt: "2026-05-16T10:05:00.000Z",
  promotedAt: null,
  sourceRawAsset: {
    id: "raw_1",
    kind: "TEXT",
    status: "PARSED",
    originalName: "motion.txt",
    mimeType: "text/plain",
    textContent: "Original pasted source\nA. Speed is constant\nB. Velocity changes uniformly",
    metadata: { page: 1 },
    createdAt: "2026-05-16T09:58:00.000Z",
    updatedAt: "2026-05-16T09:59:00.000Z",
  },
  suggestions: [
    {
      id: "suggestion_1",
      kind: "knowledge_point",
      payload: { name: "Kinematics" },
      confidence: 0.88,
      status: "pending_review",
      createdAt: "2026-05-16T10:01:00.000Z",
      updatedAt: "2026-05-16T10:01:00.000Z",
      knowledgePoint: {
        name: "Kinematics",
        slug: "kinematics",
      },
      createdByAgentRun: {
        agentName: "classifier",
        toolName: "suggest_knowledge_point",
      },
    },
  ],
  agentRuns: [
    {
      id: "agent_run_1",
      agentName: "mock-structure-agent",
      toolName: "create_question_draft",
      model: null,
      status: "SUCCEEDED",
      confidence: null,
      accepted: null,
      input: { rawAssetId: "raw_1" },
      output: { draftId: "draft_1" },
      createdAt: "2026-05-16T10:00:30.000Z",
    },
  ],
};

describe("DraftReviewWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders source material, editable draft fields, preview, and suggestions", () => {
    render(<DraftReviewWorkspace draft={draft} />);

    expect(screen.getByRole("heading", { name: "Draft Review" })).toBeInTheDocument();
    expect(screen.getByText("motion.txt")).toBeInTheDocument();
    expect(screen.getByText(/Original pasted source/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /promote/i })).not.toBeInTheDocument();

    expect(screen.getByLabelText("Stem Markdown")).toHaveValue(draft.stemMd);
    expect(screen.getByLabelText("Correct option")).toHaveValue("B");

    const preview = screen.getByRole("region", { name: "Live Preview" });
    expect(within(preview).getByText(/A cart moves/)).toBeInTheDocument();
    expect(within(preview).getByText(/Velocity changes uniformly/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();

    expect(screen.getByText("Kinematics")).toBeInTheDocument();
    expect(screen.getByText("88% confidence")).toBeInTheDocument();
    expect(screen.getByText("mock-structure-agent")).toBeInTheDocument();
  });

  it("updates the live preview without persisting edits", () => {
    render(<DraftReviewWorkspace draft={draft} />);

    fireEvent.change(screen.getByLabelText("Stem Markdown"), {
      target: { value: "Edited stem with $F=ma$." },
    });
    fireEvent.change(screen.getByLabelText("Solution Markdown"), {
      target: { value: "Edited solution." },
    });

    const preview = screen.getByRole("region", { name: "Live Preview" });
    expect(within(preview).getByText(/Edited stem/)).toBeInTheDocument();
    expect(within(preview).getByText(/Edited solution/)).toBeInTheDocument();
  });

  it("saves, sends a draft back, and rejects through PATCH /api/drafts/:id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "NEEDS_REVIEW" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "DRAFT" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "REJECTED" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<DraftReviewWorkspace draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/drafts/draft_1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      stemMd: draft.stemMd,
      answer: { type: "single", value: "B" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send back" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      status: "DRAFT",
      stemMd: draft.stemMd,
      answer: { type: "single", value: "B" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({
      status: "REJECTED",
      stemMd: draft.stemMd,
    });
  });

  it("omits an empty single-choice answer when saving an incomplete draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: "draft_1", status: "DRAFT" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DraftReviewWorkspace
        draft={{
          ...draft,
          status: "DRAFT",
          type: null,
          optionsJson: null,
          answerJson: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ stemMd: draft.stemMd });
    expect(body).not.toHaveProperty("answer");
    expect(body).not.toHaveProperty("options");
  });

  it("makes rejected drafts read-only", () => {
    render(<DraftReviewWorkspace draft={{ ...draft, status: "REJECTED" }} />);

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send back" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Stem Markdown")).toBeDisabled();
    expect(screen.getByLabelText("Solution Markdown")).toBeDisabled();
    expect(screen.getByLabelText("Correct option")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled();
  });

  it("renders the source image through the raw asset file route", () => {
    render(
      <DraftReviewWorkspace
        draft={{
          ...draft,
          sourceRawAsset: {
            ...draft.sourceRawAsset!,
            kind: "IMAGE",
            originalName: "vt.png",
            mimeType: "image/png",
          },
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "vt.png" })).toHaveAttribute(
      "src",
      "/api/raw-assets/raw_1/file",
    );
  });
});
