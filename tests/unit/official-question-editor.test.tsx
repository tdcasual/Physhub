import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfficialQuestionEditor } from "@/components/question/official-question-editor";
import { taxonomyFixtures } from "@/tests/unit/helpers/taxonomy-fixtures";

describe("OfficialQuestionEditor", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("patches knowledge point ids from checkboxes instead of a comma-separated field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OfficialQuestionEditor
        question={{
          id: "question_1",
          publicId: "q_1",
          status: "REVIEWED",
          type: "SINGLE_CHOICE",
          stemMd: "stem $a$",
          optionsJson: [
            { label: "A", value: "one" },
            { label: "B", value: "two" },
          ],
          answerJson: { type: "single", value: "A" },
          solutionMd: "sol",
          difficulty: 2,
          knowledgePointIds: ["kp_motion"],
          tagIds: [],
          version: 1,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "高一" }));
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      knowledgePointIds: ["kp_motion", "kp_g1"],
      tagIds: [],
      type: "SINGLE_CHOICE",
    });
    expect(screen.queryByLabelText("Knowledge point ids")).not.toBeInTheDocument();
  });

  it("persists the edited answer before publishing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: 2 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ question: { status: "PUBLISHED" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OfficialQuestionEditor
        question={{
          id: "question_1",
          publicId: "q_1",
          status: "REVIEWED",
          type: "SINGLE_CHOICE",
          stemMd: "stem $a$",
          optionsJson: [
            { label: "A", value: "one" },
            { label: "B", value: "two" },
          ],
          answerJson: { type: "single", value: "A" },
          solutionMd: "sol",
          difficulty: 2,
          knowledgePointIds: ["kp_motion"],
          tagIds: [],
          version: 1,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.change(screen.getByLabelText("正确选项"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "上架" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      answer: { type: "single", value: "B" },
      difficulty: 2,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      status: "PUBLISHED",
    });
  });

  it("does not publish when the field persist fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "无法保存试题" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OfficialQuestionEditor
        question={{
          id: "question_1",
          publicId: "q_1",
          status: "REVIEWED",
          type: "SINGLE_CHOICE",
          stemMd: "stem $a$",
          optionsJson: [
            { label: "A", value: "one" },
            { label: "B", value: "two" },
          ],
          answerJson: { type: "single", value: "A" },
          solutionMd: "sol",
          difficulty: 2,
          knowledgePointIds: ["kp_motion"],
          tagIds: [],
          version: 1,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.change(screen.getByLabelText("正确选项"), {
      target: { value: "B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "上架" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).status).toBeUndefined();
  });

  it("refuses save when an option value is empty", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OfficialQuestionEditor
        question={{
          id: "question_1",
          publicId: "q_1",
          status: "REVIEWED",
          type: "SINGLE_CHOICE",
          stemMd: "stem $a$",
          optionsJson: [
            { label: "A", value: "one" },
            { label: "B", value: "two" },
          ],
          answerJson: { type: "single", value: "A" },
          solutionMd: "sol",
          difficulty: 2,
          knowledgePointIds: ["kp_motion"],
          tagIds: [],
          version: 1,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.change(screen.getByLabelText("选项 2 B 内容"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));
    fireEvent.click(screen.getByRole("button", { name: "上架" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("请先补全选项和答案")).toBeInTheDocument();
    expect(screen.getByLabelText("选项 2 B 内容")).toHaveValue("");
  });

  it("includes difficulty null when clearing 未设", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OfficialQuestionEditor
        question={{
          id: "question_1",
          publicId: "q_1",
          status: "REVIEWED",
          type: "SINGLE_CHOICE",
          stemMd: "stem $a$",
          optionsJson: [
            { label: "A", value: "one" },
            { label: "B", value: "two" },
          ],
          answerJson: { type: "single", value: "A" },
          solutionMd: "sol",
          difficulty: 4,
          knowledgePointIds: ["kp_motion"],
          tagIds: [],
          version: 1,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.change(screen.getByLabelText("难度"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      difficulty: null,
    });
  });

  const reviewedQuestion = {
    id: "question_1",
    publicId: "q_1",
    status: "REVIEWED",
    type: "SINGLE_CHOICE" as const,
    stemMd: "original stem",
    optionsJson: [
      { label: "A", value: "one" },
      { label: "B", value: "two" },
    ],
    answerJson: { type: "single", value: "A" },
    solutionMd: "sol",
    difficulty: 2,
    knowledgePointIds: ["kp_motion"],
    tagIds: [] as string[],
    version: 1,
  };

  it("recovers edits made after a successful 上架 on remount", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 2, question: { status: "PUBLISHED" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <OfficialQuestionEditor
        question={reviewedQuestion}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "上架" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "after publish" },
    });
    view.unmount();

    render(
      <OfficialQuestionEditor
        question={{
          ...reviewedQuestion,
          status: "PUBLISHED",
          version: 2,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    expect(screen.getByLabelText("题干")).toHaveValue("after publish");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });

  it("keeps edits typed during save instead of marking them clean", async () => {
    let finishSave: (value: {
      ok: boolean;
      json: () => Promise<{ version: number }>;
    }) => void = () => undefined;
    const saveGate = new Promise<{
      ok: boolean;
      json: () => Promise<{ version: number }>;
    }>((resolve) => {
      finishSave = resolve;
    });
    const fetchMock = vi.fn().mockImplementationOnce(() => saveGate);
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <OfficialQuestionEditor
        question={reviewedQuestion}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "submitted stem" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("题干"), {
      target: { value: "later stem" },
    });
    finishSave({
      ok: true,
      json: async () => ({ version: 2 }),
    });
    await waitFor(() =>
      expect(screen.getByText("已保存，还有未提交的后续修改")).toBeInTheDocument(),
    );
    view.unmount();

    render(
      <OfficialQuestionEditor
        question={{
          ...reviewedQuestion,
          stemMd: "submitted stem",
          version: 2,
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    expect(screen.getByLabelText("题干")).toHaveValue("later stem");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });
});
