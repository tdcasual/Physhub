import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionEditor } from "@/components/question/question-editor";
import { taxonomyFixtures } from "@/tests/unit/helpers/taxonomy-fixtures";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function readContract() {
  fireEvent.click(screen.getByRole("button", { name: "技术细节" }));
  const contract = screen.getByText("技术细节").parentElement?.querySelector("pre");

  if (!contract) {
    throw new Error("JSON contract block was not rendered");
  }

  return JSON.parse(contract.textContent ?? "{}") as {
    options: { label: string; value: string }[];
    answer: { type: "single"; value: string };
  };
}

describe("QuestionEditor", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders the manual editor and updates the live preview", async () => {
    render(<QuestionEditor {...taxonomyFixtures} />);

    expect(
      screen.getByRole("heading", { name: "录入试题" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "预览" })).toBeInTheDocument();

    const stemInput = screen.getByLabelText("题干");
    fireEvent.change(stemInput, {
      target: { value: "A cart moves with acceleration $a$." },
    });

    const preview = screen.getByRole("region", { name: "预览" });
    expect(
      within(preview).getByText(/A cart moves with acceleration/),
    ).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("moves the answer to a valid option when the selected label is renamed", () => {
    render(<QuestionEditor {...taxonomyFixtures} />);

    fireEvent.change(screen.getAllByLabelText(/选项 .* 标记/)[1], {
      target: { value: "Beta" },
    });

    expect(screen.getByLabelText("正确选项")).toHaveValue("Beta");
    expect(readContract().answer.value).toBe("Beta");
  });

  it("moves the answer to the next valid option when the selected option is removed", () => {
    render(<QuestionEditor {...taxonomyFixtures} />);

    fireEvent.click(screen.getByRole("button", { name: "删除该选项 2（B）" }));

    const contract = readContract();
    expect(screen.getByLabelText("正确选项")).toHaveValue("A");
    expect(contract.answer.value).toBe("A");
    expect(contract.options.map((option) => option.label)).toEqual(["A", "C", "D"]);
  });

  it("keeps duplicated option labels uniquely keyed in rendered controls and preview", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(<QuestionEditor {...taxonomyFixtures} />);

      fireEvent.change(screen.getAllByLabelText(/选项 .* 标记/)[1], {
        target: { value: "A" },
      });

      const firstRowRemove = screen.getByRole("button", {
        name: "删除该选项 1（A）",
      });
      const secondRowRemove = screen.getByRole("button", {
        name: "删除该选项 2（A）",
      });

      expect(firstRowRemove).toBeInTheDocument();
      expect(secondRowRemove).toBeInTheDocument();
      expect(firstRowRemove).not.toBe(secondRowRemove);
      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining("Encountered two children with the same key"),
        expect.anything(),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("clears and disables the answer when no complete options remain", () => {
    render(<QuestionEditor {...taxonomyFixtures} />);

    while (screen.queryAllByRole("button", { name: /删除该选项/ }).length > 0) {
      fireEvent.click(screen.getAllByRole("button", { name: /删除该选项/ })[0]);
    }

    expect(screen.getByLabelText("正确选项")).toBeDisabled();
    expect(readContract()).toMatchObject({
      options: [],
      answer: { type: "single", value: "" },
    });
  });

  it("excludes incomplete options from the answer dropdown and contract", () => {
    render(<QuestionEditor {...taxonomyFixtures} />);

    fireEvent.change(screen.getAllByLabelText(/选项 .* 标记/)[1], {
      target: { value: "" },
    });

    const dropdownOptions = within(screen.getByLabelText("正确选项")).getAllByRole(
      "option",
    );

    expect(dropdownOptions.map((option) => option.textContent)).toEqual(["A", "C", "D"]);
    expect(readContract()).toMatchObject({
      options: [
        { label: "A" },
        { label: "C" },
        { label: "D" },
      ],
      answer: { type: "single", value: "A" },
    });
  });

  it("saves as a draft then navigates to the workspace", async () => {
    mockPush.mockReset();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: "draft_9" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<QuestionEditor {...taxonomyFixtures} />);
      fireEvent.click(screen.getByRole("button", { name: "存为草稿" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/drafts",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
        type: "SINGLE_CHOICE",
        options: [
          { label: "A", value: "物体一直做匀速直线运动" },
          { label: "B", value: "物体先做匀加速运动，后做匀速运动" },
          { label: "C", value: "物体的加速度一直增大" },
          { label: "D", value: "物体在 $t=2\\text{s}$ 时回到出发点" },
        ],
        answer: { type: "single", value: "B" },
        knowledgePointIds: [],
        tagIds: [],
        difficulty: null,
      });
      expect(mockPush).toHaveBeenCalledWith("/drafts/draft_9");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("posts unfinished options and an empty answer when saving a draft", async () => {
    mockPush.mockReset();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: "draft_9" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<QuestionEditor {...taxonomyFixtures} />);
      fireEvent.change(screen.getAllByLabelText(/选项 .* 内容/)[1], {
        target: { value: "" },
      });
      fireEvent.click(screen.getByRole("button", { name: "存为草稿" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
        options: { label: string; value: string }[];
        answer: { type: string; value: string };
      };
      expect(body.options).toHaveLength(4);
      expect(body.options[1]).toEqual({
        label: "B",
        value: "",
      });
      expect(body.answer).toEqual({ type: "single", value: "A" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("saves selected knowledge point ids by name, not a comma-separated cuid field", async () => {
    mockPush.mockReset();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ draft: { id: "draft_9" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      render(<QuestionEditor {...taxonomyFixtures} />);
      fireEvent.click(screen.getByRole("checkbox", { name: "运动学" }));
      fireEvent.click(screen.getByRole("button", { name: "存为草稿" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
        knowledgePointIds: ["kp_motion"],
      });
      expect(screen.queryByLabelText("Knowledge point ids")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
