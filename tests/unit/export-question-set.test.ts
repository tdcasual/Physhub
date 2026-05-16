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

  it("preserves ordinary inline math and LaTeX macros in latex exports", () => {
    const latex = renderQuestionToLatex({
      ...question,
      stemMd: "速度为 $v$，位移为 $\\frac{1}{2}at^2$。",
    });

    expect(latex).toContain("$v$");
    expect(latex).toContain("\\frac{1}{2}");
  });

  it("omits answer and solution from student latex exports", () => {
    const latex = renderQuestionToLatex(question, false);

    expect(latex).not.toContain("\\begin{solution}");
    expect(latex).not.toContain("答案：A");
    expect(latex).not.toContain("解析：");
  });

  it("blocks dangerous latex commands without escaping safe math", () => {
    const latex = renderQuestionToLatex({
      publicId: "q_dangerous",
      stemMd: "速度 $v$ \\input{secret}",
      optionsJson: [{ label: "A", value: "\\usepackage{evil} $\\frac{1}{2}$" }],
      answerJson: { type: "single", value: "\\write18{rm -rf /}" },
      solutionMd: "\\begin{document}解析\\end{document}",
    });

    expect(latex).toContain("$v$");
    expect(latex).toContain("\\frac{1}{2}");
    expect(latex).not.toContain("\\input");
    expect(latex).not.toContain("\\usepackage");
    expect(latex).not.toContain("\\write18");
    expect(latex).not.toContain("\\begin{document}");
    expect(latex).not.toContain("\\end{document}");
    expect(latex).toContain("[blocked LaTeX command:");
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
    const exportJob = {
      id: "export_1",
      status: "SUCCEEDED",
      format: "markdown",
      questionSetId: "set_1",
      outputKey: null,
      createdAt: new Date("2026-05-17T00:00:00.000Z"),
      updatedAt: new Date("2026-05-17T00:00:00.000Z"),
      internalSecret: "do-not-leak",
    };
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
      exportJob: {
        id: "export_1",
        status: "SUCCEEDED",
        format: "markdown",
        questionSetId: "set_1",
        outputKey: null,
      },
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

  it("defaults an empty request body to markdown", async () => {
    mockQuestionSetFindUnique.mockResolvedValue({
      id: "set_1",
      items: [{ question, sortOrder: 1 }],
    });
    mockExportJobCreate.mockResolvedValue({
      id: "export_1",
      status: "SUCCEEDED",
      format: "markdown",
      questionSetId: "set_1",
      outputKey: null,
    });
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: "" }),
      { params: Promise.resolve({ id: "set_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockExportJobCreate).toHaveBeenCalledWith({
      data: {
        questionSetId: "set_1",
        format: "markdown",
        status: "SUCCEEDED",
        outputKey: null,
      },
    });
    await expect(response.json()).resolves.toEqual({
      exportJob: {
        id: "export_1",
        status: "SUCCEEDED",
        format: "markdown",
        questionSetId: "set_1",
        outputKey: null,
      },
      content: expect.stringContaining("答案：A"),
    });
  });

  it("exports latex when requested", async () => {
    mockQuestionSetFindUnique.mockResolvedValue({
      id: "set_1",
      items: [{ question, sortOrder: 1 }],
    });
    mockExportJobCreate.mockResolvedValue({
      id: "export_1",
      status: "SUCCEEDED",
      format: "latex",
      questionSetId: "set_1",
      outputKey: null,
      createdAt: new Date("2026-05-17T00:00:00.000Z"),
      updatedAt: new Date("2026-05-17T00:00:00.000Z"),
    });
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
      exportJob: {
        id: "export_1",
        status: "SUCCEEDED",
        format: "latex",
        questionSetId: "set_1",
        outputKey: null,
      },
      content: expect.stringContaining("\\choice"),
    });
  });

  it("uses the markdown separator between multiple exported questions", async () => {
    mockQuestionSetFindUnique.mockResolvedValue({
      id: "set_1",
      items: [
        { question, sortOrder: 1 },
        { question: { ...question, publicId: "q_motion_0002" }, sortOrder: 2 },
      ],
    });
    mockExportJobCreate.mockResolvedValue({
      id: "export_1",
      status: "SUCCEEDED",
      format: "markdown",
      questionSetId: "set_1",
      outputKey: null,
    });
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

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.content).toContain("\n\n---\n\n");
    expect(payload.content.match(/<!-- q_motion_/g)).toHaveLength(2);
  });

  it("returns stable errors for malformed and non-object JSON bodies", async () => {
    const { POST } = await import(
      "@/app/api/question-sets/[id]/export/route"
    );

    const malformedResponse = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: "{",
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({
      error: "Malformed JSON request body",
    });

    const arrayResponse = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify([]),
      }),
      { params: Promise.resolve({ id: "set_1" }) },
    );
    expect(arrayResponse.status).toBe(400);
    await expect(arrayResponse.json()).resolves.toEqual({
      error: "Request body must be an object",
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
