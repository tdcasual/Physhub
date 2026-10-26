import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DraftReviewWorkspace,
  type DraftReviewWorkspaceDraft,
} from "@/components/draft/draft-review-workspace";
import { taxonomyFixtures } from "@/tests/unit/helpers/taxonomy-fixtures";

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
  difficulty: 2,
  knowledgePointIds: ["kp_motion"],
  tagIds: [],
  aiOutput: { source: "mock parser" },
  createdAt: "2026-05-16T10:00:00.000Z",
  updatedAt: "2026-05-16T10:05:00.000Z",
  promotedAt: null,
  promotedQuestionId: null,
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

function renderWorkspace(
  value: DraftReviewWorkspaceDraft = draft,
) {
  return render(
    <DraftReviewWorkspace
      draft={value}
      knowledgePoints={taxonomyFixtures.knowledgePoints}
      tags={taxonomyFixtures.tags}
    />,
  );
}

describe("DraftReviewWorkspace", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders source material, editable draft fields, preview, and suggestions", () => {
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "审题" })).toBeInTheDocument();
    expect(screen.getByText("motion.txt")).toBeInTheDocument();
    expect(screen.getByText(/Original pasted source/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^退回$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退回草稿" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "入库" })).toBeInTheDocument();

    expect(screen.getByLabelText("题干")).toHaveValue(draft.stemMd);
    expect(screen.getByLabelText("正确选项")).toHaveValue("B");

    const preview = screen.getByRole("region", { name: "预览" });
    expect(within(preview).getByText(/A cart moves/)).toBeInTheDocument();
    expect(within(preview).getByText(/Velocity changes uniformly/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();

    expect(screen.getByText("Kinematics")).toBeInTheDocument();
    expect(screen.getByText("置信度 88%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "运行记录" }));
    expect(screen.getByText("mock-structure-agent")).toBeInTheDocument();
  });

  it("updates the live preview without persisting edits", () => {
    renderWorkspace();

    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "Edited stem with $F=ma$." },
    });
    fireEvent.change(screen.getByLabelText("解析"), {
      target: { value: "Edited solution." },
    });

    const preview = screen.getByRole("region", { name: "预览" });
    expect(within(preview).getByText(/Edited stem/)).toBeInTheDocument();
    expect(within(preview).getByText(/Edited solution/)).toBeInTheDocument();
  });

  it("saves and rejects through PATCH /api/drafts/:id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "NEEDS_REVIEW" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "REJECTED" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
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
      difficulty: draft.difficulty,
    });

    fireEvent.click(screen.getByRole("button", { name: /^退回$/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      status: "REJECTED",
      stemMd: draft.stemMd,
    });
  });

  it("persists empty options and an empty answer when saving an incomplete draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: "draft_1", status: "DRAFT" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace({
      ...draft,
      status: "DRAFT",
      type: null,
      optionsJson: null,
      answerJson: null,
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      stemMd: draft.stemMd,
      options: [],
      answer: { type: "single", value: "" },
      difficulty: draft.difficulty,
    });
    expect(body).not.toHaveProperty("type");
  });

  it("makes rejected drafts read-only", () => {
    renderWorkspace({ ...draft, status: "REJECTED" });

    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^退回$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "退回草稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "入库" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("题干")).toBeDisabled();
    expect(screen.getByLabelText("解析")).toBeDisabled();
    expect(screen.getByLabelText("正确选项")).toBeDisabled();
    expect(screen.getByRole("button", { name: "加选项" })).toBeDisabled();
  });

  it("renders the source image through the raw asset file route", () => {
    renderWorkspace({
      ...draft,
      sourceRawAsset: {
        ...draft.sourceRawAsset!,
        kind: "IMAGE",
        originalName: "vt.png",
        mimeType: "image/png",
      },
    });

    expect(screen.getByRole("img", { name: "vt.png" })).toHaveAttribute(
      "src",
      "/api/raw-assets/raw_1/file",
    );
  });

  it("hides promote on already promoted drafts and shows the official question id", () => {
    renderWorkspace({
      ...draft,
      status: "PROMOTED",
      promotedAt: "2026-05-16T10:10:00.000Z",
      promotedQuestionId: "question_9",
    });

    expect(screen.queryByRole("button", { name: "入库" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.getByText(/题库 question_9/)).toBeInTheDocument();
    expect(screen.getAllByText(/已入库/).length).toBeGreaterThan(0);
  });

  it("persists editor fields then shows validation errors from promote", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "NEEDS_REVIEW" } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "答案必须匹配选项" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "入库" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/drafts/draft_1");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      stemMd: draft.stemMd,
      answer: { type: "single", value: "B" },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/drafts/draft_1/promote",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(screen.getByText("答案必须匹配选项")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "入库" })).toBeInTheDocument();
  });

  it("does not promote if persisting editor fields fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unable to update draft" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "入库" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/drafts/draft_1");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.getByText("无法保存草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "入库" })).toBeInTheDocument();
  });

  it("shows promotedAt and the new question id after a successful promote", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "NEEDS_REVIEW" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            id: "draft_1",
            status: "PROMOTED",
            promotedAt: "2026-05-16T10:20:00.000Z",
            promotedQuestionId: "question_1",
          },
          question: { id: "question_1" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "入库" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/drafts/draft_1");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/drafts/draft_1/promote");

    expect(screen.queryByRole("button", { name: "入库" })).not.toBeInTheDocument();
    expect(screen.getByText(/题库 question_1/)).toBeInTheDocument();
    expect(screen.getAllByText(/已入库/).length).toBeGreaterThan(0);
  });

  it("accepts and rejects pending suggestions through PATCH /api/suggestions/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: { id: "suggestion_1", status: "accepted" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "接受建议" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/suggestions/suggestion_1",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      status: "accepted",
    });
  });

  it("rejects a pending suggestion through PATCH /api/suggestions/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: { id: "suggestion_1", status: "rejected" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "不用该建议" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      status: "rejected",
    });
  });

  it("disables Accept when a knowledge point in the payload lacks id", () => {
    renderWorkspace({
      ...draft,
      suggestions: [
        {
          ...draft.suggestions[0],
          kind: "metadata",
          payload: {
            knowledge_points: [
              {
                value: "v-t 图像面积表示位移",
                confidence: 0.86,
                reason: "规则无法带 id",
              },
            ],
            difficulty: { value: 2, confidence: 0.72, reason: "基础" },
            risks: [],
          },
        },
      ],
    });

    expect(screen.getByRole("button", { name: "接受建议" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "不用该建议" })).toBeEnabled();
  });

  it("disables promote until a knowledge point is selected", () => {
    renderWorkspace({
      ...draft,
      knowledgePointIds: [],
    });

    expect(screen.getByRole("button", { name: "入库" })).toBeDisabled();
    expect(
      screen.getByText("入库前请先勾选至少一个知识点。"),
    ).toBeInTheDocument();
  });

  it("includes knowledge point ids when saving and promoting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ draft: { id: "draft_1", status: "NEEDS_REVIEW" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            id: "draft_1",
            status: "PROMOTED",
            promotedAt: "2026-05-16T10:20:00.000Z",
            promotedQuestionId: "question_1",
          },
          question: { id: "question_1" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace();
    fireEvent.click(screen.getByRole("checkbox", { name: "高一" }));
    fireEvent.click(screen.getByRole("button", { name: "入库" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      knowledgePointIds: ["kp_motion", "kp_g1"],
      type: "SINGLE_CHOICE",
    });
  });

  it("attaches a source together with the current editor snapshot", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/raw-assets") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ rawAsset: { id: "raw_new" } }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          draft: {
            id: "draft_1",
            status: "NEEDS_REVIEW",
            updatedAt: "2026-05-16T11:00:00.000Z",
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderWorkspace();
    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "edited stem after attach" },
    });
    fireEvent.change(screen.getByLabelText("来源图片或文本文件"), {
      target: {
        files: [new File(["png"], "source.png", { type: "image/png" })],
      },
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    const patchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/api/drafts/draft_1"),
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      stemMd: "edited stem after attach",
      sourceRawAssetId: "raw_new",
    });

    view.unmount();
    renderWorkspace({
      ...draft,
      stemMd: "edited stem after attach",
      updatedAt: "2026-05-16T11:00:00.000Z",
    });
    expect(screen.getByLabelText("题干")).toHaveValue("edited stem after attach");
  });

  const metadataDraft: DraftReviewWorkspaceDraft = {
    ...draft,
    suggestions: [
      {
        id: "suggestion_meta",
        kind: "metadata",
        payload: {
          knowledge_points: [{ id: "kp_g1", value: "高一" }],
          difficulty: { value: 4 },
          tag_ids: ["tag_image"],
        },
        confidence: 0.9,
        status: "pending_review",
        createdAt: "2026-05-16T10:01:00.000Z",
        updatedAt: "2026-05-16T10:01:00.000Z",
        knowledgePoint: null,
        createdByAgentRun: {
          agentName: "classifier",
          toolName: "suggest_metadata",
        },
      },
    ],
  };

  it("recovers unsaved stem after accepting metadata that advances updatedAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestion: { id: "suggestion_meta", status: "accepted" },
        draft: {
          updatedAt: "2026-05-16T11:00:00.000Z",
          knowledgePointIds: ["kp_g1"],
          difficulty: 4,
          tagIds: ["tag_image"],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = renderWorkspace(metadataDraft);
    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "unsaved teacher edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "接受建议" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    view.unmount();

    renderWorkspace({
      ...metadataDraft,
      updatedAt: "2026-05-16T11:00:00.000Z",
      knowledgePointIds: ["kp_g1"],
      difficulty: 4,
      tagIds: ["tag_image"],
    });

    expect(screen.getByLabelText("题干")).toHaveValue("unsaved teacher edit");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });

  it("saves accepted metadata instead of stale editor fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestion: { id: "suggestion_meta", status: "accepted" },
          draft: {
            updatedAt: "2026-05-16T11:00:00.000Z",
            knowledgePointIds: ["kp_g1"],
            difficulty: 4,
            tagIds: ["tag_image"],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          draft: {
            id: "draft_1",
            status: "NEEDS_REVIEW",
            updatedAt: "2026-05-16T11:05:00.000Z",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWorkspace(metadataDraft);
    fireEvent.click(screen.getByRole("button", { name: "接受建议" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      knowledgePointIds: ["kp_g1"],
      difficulty: 4,
      tagIds: ["tag_image"],
    });
  });
});
