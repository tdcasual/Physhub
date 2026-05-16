import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import {
  renderQuestionToLatex,
  renderQuestionToMarkdown,
} from "@/lib/renderer/export-question-set";

type ExportFormat = "markdown" | "latex";

type ExportBody = {
  format: ExportFormat;
  teacher: boolean;
};

type ExportApiErrorResponse = {
  error: string;
  status: 400 | 404 | 500;
};

function parseExportBody(input: unknown): ExportBody {
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

async function readJsonBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return undefined;
  }

  return JSON.parse(rawBody) as unknown;
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = parseExportBody(await readJsonBody(request));
    const questionSet = await prisma.questionSet.findUnique({
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

    const exportJob = await prisma.exportJob.create({
      data: {
        questionSetId: questionSet.id,
        format: body.format,
        status: "SUCCEEDED",
        outputKey: null,
      },
    });

    return NextResponse.json({ exportJob, content });
  } catch (error) {
    const response = mapQuestionSetExportApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
