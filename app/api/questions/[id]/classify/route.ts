import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { suggestMetadata } from "@/lib/workers/mock-classification-agent";

type QuestionClassifyRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  context: QuestionClassifyRouteContext,
) {
  const { id } = await context.params;
  const question = await prisma.question.findUnique({ where: { id } });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  try {
    const output = suggestMetadata(question.stemMd);
    const confidence = output.knowledge_points[0]?.confidence;
    const agentRun = await prisma.agentRun.create({
      data: {
        agentName: "mock-classification-agent",
        toolName: "classify_question",
        input: { questionId: question.id, stemMd: question.stemMd },
        output,
        confidence,
      },
    });

    const suggestion = await prisma.suggestion.create({
      data: {
        questionId: question.id,
        kind: "metadata",
        payload: output,
        confidence,
        createdByAgentRunId: agentRun.id,
      },
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to classify question" },
      { status: 500 },
    );
  }
}
