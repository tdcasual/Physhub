import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionSearchPanel } from "@/components/search/question-search-panel";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuestionSearchPanel", () => {
  it("posts a natural-language query with reviewed/published constraints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        understanding: {
          rawQuery: "找高一运动学基础题",
          terms: ["高一", "运动学"],
          limit: 10,
        },
        results: [
          {
            id: "question_1",
            question_id: "q_motion_0001",
            score: 22,
            reason: "text:运动学",
            reasons: [{ field: "text", value: "运动学" }],
            stemMd: "高一运动学 v-t 图像题",
            status: "PUBLISHED",
            type: "SINGLE_CHOICE",
          },
        ],
      }),
    } as Response);

    render(<QuestionSearchPanel />);

    fireEvent.change(screen.getByLabelText("Natural-language question search"), {
      target: { value: "找高一运动学基础题" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/search/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "找高一运动学基础题",
          constraints: {
            status: ["PUBLISHED", "REVIEWED"],
            limit: 10,
          },
        }),
      });
    });

    expect(
      await screen.findByRole("heading", { name: "q_motion_0001" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Score 22")).toBeInTheDocument();
    expect(screen.getByText("text:运动学")).toBeInTheDocument();
  });

  it("shows a useful error when the search request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Search query is required" }),
    } as Response);

    render(<QuestionSearchPanel />);

    fireEvent.change(screen.getByLabelText("Natural-language question search"), {
      target: { value: "位移" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search query is required",
    );
  });
});
