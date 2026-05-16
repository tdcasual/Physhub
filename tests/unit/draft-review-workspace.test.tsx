import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    storageKey: null,
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
  it("renders source material, editable draft fields, preview, and suggestions", () => {
    render(<DraftReviewWorkspace draft={draft} />);

    expect(screen.getByRole("heading", { name: "Draft Review" })).toBeInTheDocument();
    expect(screen.getByText("motion.txt")).toBeInTheDocument();
    expect(screen.getByText(/Original pasted source/)).toBeInTheDocument();

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
});
