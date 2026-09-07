import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import { suggestMetadata } from "@/lib/workers/mock-classification-agent";

type QuestionClassifyRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: QuestionClassifyRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  if (process.env.ENABLE_MOCK_CLASSIFY !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await context.params;

  try {
    const question = await prisma.question.findUnique({ where: { id } });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const output = suggestMetadata(question.stemMd);
    const confidence = output.knowledge_points[0]?.confidence;

    const suggestion = await prisma.$transaction(async (tx) => {
      const agentRun = await tx.agentRun.create({
        data: {
          agentName: "mock-classification-agent",
          toolName: "classify_question",
          input: { questionId: question.id, stemMd: question.stemMd },
          output,
          confidence,
        },
      });

      return tx.suggestion.create({
        data: {
          questionId: question.id,
          kind: "metadata",
          payload: output,
          confidence,
          createdByAgentRunId: agentRun.id,
        },
      });
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to classify question" },
      { status: 500 },
    );
  }
}
