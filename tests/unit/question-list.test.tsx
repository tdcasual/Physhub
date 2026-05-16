import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  QuestionList,
  type QuestionListItem,
} from "@/components/question/question-list";

const questions: QuestionListItem[] = [
  {
    id: "question_1",
    publicId: "q_motion_0001",
    type: "SINGLE_CHOICE",
    status: "PUBLISHED",
    stemMd: "A cart moves with acceleration $a$.",
    difficulty: 2,
    updatedAt: "2026-05-15T08:00:00.000Z",
    primaryKnowledgePointName: "运动学",
    tagNames: ["随堂练习"],
  },
];

describe("QuestionList", () => {
  it("renders question summaries with stable metadata", () => {
    render(<QuestionList questions={questions} />);

    expect(
      screen.getByRole("heading", { name: "q_motion_0001" }),
    ).toBeInTheDocument();
    expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
    expect(screen.getByText("SINGLE CHOICE")).toBeInTheDocument();
    expect(screen.getByText("Difficulty 2")).toBeInTheDocument();
    expect(screen.getByText("运动学")).toBeInTheDocument();
    expect(screen.getByText("随堂练习")).toBeInTheDocument();
    expect(screen.getByText(/A cart moves with acceleration/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("renders an empty state when no questions are available", () => {
    render(<QuestionList questions={[]} />);

    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
  });
});
