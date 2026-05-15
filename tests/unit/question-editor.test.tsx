import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionEditor } from "@/components/question/question-editor";

function readContract() {
  const contract = screen
    .getByRole("heading", { name: "JSON Contract" })
    .nextElementSibling;

  if (!contract) {
    throw new Error("JSON contract block was not rendered");
  }

  return JSON.parse(contract.textContent ?? "{}") as {
    options: { label: string; value: string }[];
    answer: { type: "single"; value: string };
  };
}

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

  it("moves the answer to a valid option when the selected label is renamed", () => {
    render(<QuestionEditor />);

    fireEvent.change(screen.getAllByLabelText(/Option .* label/)[1], {
      target: { value: "Beta" },
    });

    expect(screen.getByLabelText("Correct option")).toHaveValue("Beta");
    expect(readContract().answer.value).toBe("Beta");
  });

  it("moves the answer to the next valid option when the selected option is removed", () => {
    render(<QuestionEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Remove option row 2 (B)" }));

    const contract = readContract();
    expect(screen.getByLabelText("Correct option")).toHaveValue("A");
    expect(contract.answer.value).toBe("A");
    expect(contract.options.map((option) => option.label)).toEqual(["A", "C", "D"]);
  });

  it("keeps remove controls uniquely named when option labels are duplicated", () => {
    render(<QuestionEditor />);

    fireEvent.change(screen.getAllByLabelText(/Option .* label/)[1], {
      target: { value: "A" },
    });

    const firstRowRemove = screen.getByRole("button", {
      name: "Remove option row 1 (A)",
    });
    const secondRowRemove = screen.getByRole("button", {
      name: "Remove option row 2 (A)",
    });

    expect(firstRowRemove).toBeInTheDocument();
    expect(secondRowRemove).toBeInTheDocument();
    expect(firstRowRemove).not.toBe(secondRowRemove);
  });

  it("clears and disables the answer when no complete options remain", () => {
    render(<QuestionEditor />);

    while (screen.queryAllByRole("button", { name: /Remove option/ }).length > 0) {
      fireEvent.click(screen.getAllByRole("button", { name: /Remove option/ })[0]);
    }

    expect(screen.getByLabelText("Correct option")).toBeDisabled();
    expect(readContract()).toMatchObject({
      options: [],
      answer: { type: "single", value: "" },
    });
  });

  it("excludes incomplete options from the answer dropdown and contract", () => {
    render(<QuestionEditor />);

    fireEvent.change(screen.getAllByLabelText(/Option .* label/)[1], {
      target: { value: "" },
    });

    const dropdownOptions = within(screen.getByLabelText("Correct option")).getAllByRole(
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
});
