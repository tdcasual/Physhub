import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { parseTextToDraft } from "@/lib/workers/mock-parse-worker";

type RawAssetParseRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RawAssetParseRouteContext,
) {
  const { id } = await context.params;
  const rawAsset = await prisma.rawAsset.findUnique({
    where: { id },
  });

  if (!rawAsset) {
    return NextResponse.json({ error: "Raw asset not found" }, { status: 404 });
  }

  const parsed = parseTextToDraft(rawAsset.textContent ?? "");

  const draft = await prisma.$transaction(async (tx) => {
    const parseJob = await tx.parseJob.create({
      data: {
        rawAssetId: rawAsset.id,
        status: "RUNNING",
        jobType: "mock_parse_text",
        input: {
          rawAssetId: rawAsset.id,
        },
      },
    });

    const questionDraft = await tx.questionDraft.create({
      data: {
        status: "NEEDS_REVIEW",
        type: parsed.type,
        stemMd: parsed.stemMd,
        optionsJson: parsed.optionsJson ?? undefined,
        answerJson: parsed.answerJson ?? undefined,
        solutionMd: parsed.solutionMd ?? null,
        sourceRawAssetId: rawAsset.id,
        aiOutput: parsed,
      },
    });

    await tx.parseJob.update({
      where: {
        id: parseJob.id,
      },
      data: {
        status: "SUCCEEDED",
        output: {
          draftId: questionDraft.id,
        },
      },
    });

    await tx.agentRun.create({
      data: {
        agentName: "mock-structure-agent",
        toolName: "create_question_draft",
        status: "SUCCEEDED",
        input: {
          rawAssetId: rawAsset.id,
        },
        output: parsed,
        draftId: questionDraft.id,
      },
    });

    return questionDraft;
  });

  return NextResponse.json({ draft }, { status: 201 });
}
