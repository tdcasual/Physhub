import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfficialQuestionEditor } from "@/components/question/official-question-editor";
import { taxonomyFixtures } from "@/tests/unit/helpers/taxonomy-fixtures";

describe("OfficialQuestionEditor", () => {
  afterEach(() => {
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
        }}
        knowledgePoints={taxonomyFixtures.knowledgePoints}
        tags={taxonomyFixtures.tags}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "高一" }));
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      knowledgePointIds: ["kp_motion", "kp_g1"],
      tagIds: [],
      type: "SINGLE_CHOICE",
    });
    expect(screen.queryByLabelText("Knowledge point ids")).not.toBeInTheDocument();
  });
});
