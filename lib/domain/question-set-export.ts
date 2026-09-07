import { prisma } from "@/lib/db/prisma";
import {
  renderQuestionToLatex,
  renderQuestionToMarkdown,
} from "@/lib/renderer/export-question-set";

type ExportFormat = "markdown" | "latex";

export type ExportBody = {
  format: ExportFormat;
  teacher: boolean;
};

type QuestionSetExportDb = {
  questionSet: {
    findUnique: (typeof prisma)["questionSet"]["findUnique"];
  };
  exportJob: {
    create: (typeof prisma)["exportJob"]["create"];
  };
};

type ExportApiErrorResponse = {
  error: string;
  status: 400 | 404 | 500;
};

type ExportJobDto = {
  id: string;
  status: string;
  format: string;
  questionSetId: string | null;
  outputKey: string | null;
};

function toExportJobDto(exportJob: ExportJobDto): ExportJobDto {
  return {
    id: exportJob.id,
    status: exportJob.status,
    format: exportJob.format,
    questionSetId: exportJob.questionSetId,
    outputKey: exportJob.outputKey,
  };
}

export function parseExportBody(input: unknown): ExportBody {
  if (input === undefined) {
    return { format: "markdown", teacher: true };
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Request body must be an object");
  }

  const candidate = input as Record<string, unknown>;
  const format = candidate.format ?? "markdown";

  if (format !== "markdown" && format !== "latex") {
    throw new Error("format must be markdown or latex");
  }

  return {
    format,
    teacher: candidate.teacher !== false,
  };
}

export async function readJsonBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return undefined;
  }

  return JSON.parse(rawBody) as unknown;
}

export async function createQuestionSetExport(
  id: string,
  body: ExportBody,
  db: QuestionSetExportDb = prisma,
) {
  const questionSet = await db.questionSet.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { question: true } },
    },
  });

  if (!questionSet) {
    throw new Error("Question set not found");
  }

  const content = questionSet.items
    .map((item) =>
      body.format === "latex"
        ? renderQuestionToLatex(item.question, body.teacher)
        : renderQuestionToMarkdown(item.question, body.teacher),
    )
    .join("\n\n---\n\n");

  const exportJob = await db.exportJob.create({
    data: {
      questionSetId: questionSet.id,
      format: body.format,
      status: "SUCCEEDED",
      outputKey: null,
    },
  });

  return { exportJob: toExportJobDto(exportJob), content };
}

export function mapQuestionSetExportApiError(
  error: unknown,
): ExportApiErrorResponse {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof Error && error.message === "Question set not found") {
    return { error: error.message, status: 404 };
  }

  if (
    error instanceof Error &&
    (error.message === "Request body must be an object" ||
      error.message === "format must be markdown or latex")
  ) {
    return { error: error.message, status: 400 };
  }

  return { error: "Unable to export question set", status: 500 };
}
