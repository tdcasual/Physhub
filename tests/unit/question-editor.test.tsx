import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionEditor } from "@/components/question/question-editor";

describe("QuestionEditor", () => {
  it("renders the manual editor and updates the live preview", async () => {
    render(<QuestionEditor />);

    expect(
      screen.getByRole("heading", { name: "Manual Question Editor" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live Preview" })).toBeInTheDocument();

    const stemInput = screen.getByLabelText("Stem Markdown");
    fireEvent.change(stemInput, {
      target: { value: "A cart moves with acceleration $a$." },
    });

    const preview = screen.getByRole("region", { name: "Live Preview" });
    expect(
      within(preview).getByText(/A cart moves with acceleration/),
    ).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });
});
