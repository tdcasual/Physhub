import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExportJobCreate, mockQuestionSetFindUnique } = vi.hoisted(() => ({
  mockExportJobCreate: vi.fn(),
  mockQuestionSetFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    exportJob: {
      create: mockExportJobCreate,
    },
    questionSet: {
      findUnique: mockQuestionSetFindUnique,
    },
  },
}));

import {
  renderQuestionToLatex,
  renderQuestionToMarkdown,
} from "@/lib/renderer/export-question-set";

const question = {
  publicId: "q_motion_0001",
  stemMd: "速度为 $v$。",
  optionsJson: [{ label: "A", value: "$v$" }],
  answerJson: { type: "single", value: "A" },
  solutionMd: "解析",
};

describe("question exports", () => {
  it("renders markdown with the public id, answer, and solution for teachers", () => {
    const markdown = renderQuestionToMarkdown(question);

    expect(markdown).toContain("<!-- q_motion_0001 -->");
    expect(markdown).toContain("A. $v$");
    expect(markdown).toContain("答案：A");
    expect(markdown).toContain("解析：\n解析");
  });

  it("omits answer and solution from student markdown exports", () => {
    const markdown = renderQuestionToMarkdown(question, false);

    expect(markdown).not.toContain("答案：A");
    expect(markdown).not.toContain("解析：");
  });

  it("renders latex choices", () => {
    expect(renderQuestionToLatex(question)).toContain("\\choice");
  });

  it("handles unsafe option and answer JSON without mutating the question", () => {
    const unsafeQuestion = {
      ...question,
      optionsJson: [{ label: "A", value: "$v$" }, { value: "missing label" }],
      answerJson: { type: "single", value: ["A", "B"] },
    };
    const originalOptions = unsafeQuestion.optionsJson.map((option) => ({
      ...option,
    }));

    expect(renderQuestionToMarkdown(unsafeQuestion)).toContain("答案：A, B");
    expect(unsafeQuestion.optionsJson).toEqual(originalOptions);
  });
});

describe("question set export route", () => {
  beforeEach(() => {
    mockExportJobCreate.mockReset();
    mockQuestionSetFindUnique.mockReset();
  });

  it("exports markdown by default and creates a succeeded export job", async () => {
    const exportJob = { id: "export_1", status: "SUCCEEDED" };
    mockQuestionSetFindUnique.mockResolvedValue({
      id: "set_1",
      items: [{ question, sortOrder: 1 }],
    });
    mockExportJobCreate.mockResolvedValue(exportJob);
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      exportJob,
      content: expect.stringContaining("答案：A"),
    });
    expect(mockQuestionSetFindUnique).toHaveBeenCalledWith({
      where: { id: "set_1" },
      include: {
        items: { orderBy: { sortOrder: "asc" }, include: { question: true } },
      },
    });
    expect(mockExportJobCreate).toHaveBeenCalledWith({
      data: {
        questionSetId: "set_1",
        format: "markdown",
        status: "SUCCEEDED",
        outputKey: null,
      },
    });
  });

  it("exports latex when requested", async () => {
    mockQuestionSetFindUnique.mockResolvedValue({
      id: "set_1",
      items: [{ question, sortOrder: 1 }],
    });
    mockExportJobCreate.mockResolvedValue({ id: "export_1" });
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ format: "latex" }),
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      exportJob: { id: "export_1" },
      content: expect.stringContaining("\\choice"),
    });
  });

  it("returns stable errors for invalid formats and missing sets", async () => {
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const invalidFormatResponse = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ format: "pdf" }),
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );
    expect(invalidFormatResponse.status).toBe(400);
    await expect(invalidFormatResponse.json()).resolves.toEqual({
      error: "format must be markdown or latex",
    });

    mockQuestionSetFindUnique.mockResolvedValue(null);
    const missingSetResponse = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ format: "markdown" }),
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(missingSetResponse.status).toBe(404);
    await expect(missingSetResponse.json()).resolves.toEqual({
      error: "Question set not found",
    });
  });

  it("returns a stable 500 error when persistence fails", async () => {
    mockQuestionSetFindUnique.mockRejectedValue(new Error("secret"));
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ format: "markdown" }),
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to export question set",
    });
  });
});
