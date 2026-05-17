import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  DraftReviewWorkspace,
  type DraftReviewWorkspaceDraft,
  type JsonValue,
} from "@/components/draft/draft-review-workspace";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const draftSelect = {
  id: true,
  status: true,
  type: true,
  stemMd: true,
  optionsJson: true,
  answerJson: true,
  solutionMd: true,
  aiOutput: true,
  createdAt: true,
  updatedAt: true,
  promotedAt: true,
  sourceRawAsset: {
    select: {
      id: true,
      kind: true,
      status: true,
      originalName: true,
      mimeType: true,
      textContent: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  suggestions: {
    select: {
      id: true,
      kind: true,
      payload: true,
      confidence: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      knowledgePoint: {
        select: {
          name: true,
          slug: true,
        },
      },
      createdByAgentRun: {
        select: {
          agentName: true,
          toolName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  agentRuns: {
    select: {
      id: true,
      agentName: true,
      toolName: true,
      model: true,
      status: true,
      confidence: true,
      accepted: true,
      input: true,
      output: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.QuestionDraftSelect;

type DraftRecord = Prisma.QuestionDraftGetPayload<{
  select: typeof draftSelect;
}>;

function toJsonValue(value: Prisma.JsonValue | null): JsonValue | null {
  return value as JsonValue | null;
}

function toWorkspaceDraft(draft: DraftRecord): DraftReviewWorkspaceDraft {
  return {
    id: draft.id,
    status: draft.status,
    type: draft.type,
    stemMd: draft.stemMd,
    optionsJson: toJsonValue(draft.optionsJson),
    answerJson: toJsonValue(draft.answerJson),
    solutionMd: draft.solutionMd,
    aiOutput: toJsonValue(draft.aiOutput),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
    promotedAt: draft.promotedAt?.toISOString() ?? null,
    sourceRawAsset: draft.sourceRawAsset
      ? {
          id: draft.sourceRawAsset.id,
          kind: draft.sourceRawAsset.kind,
          status: draft.sourceRawAsset.status,
          originalName: draft.sourceRawAsset.originalName,
          mimeType: draft.sourceRawAsset.mimeType,
          textContent: draft.sourceRawAsset.textContent,
          metadata: toJsonValue(draft.sourceRawAsset.metadata),
          createdAt: draft.sourceRawAsset.createdAt.toISOString(),
          updatedAt: draft.sourceRawAsset.updatedAt.toISOString(),
        }
      : null,
    suggestions: draft.suggestions.map((suggestion) => ({
      id: suggestion.id,
      kind: suggestion.kind,
      payload: toJsonValue(suggestion.payload) ?? {},
      confidence: suggestion.confidence,
      status: suggestion.status,
      createdAt: suggestion.createdAt.toISOString(),
      updatedAt: suggestion.updatedAt.toISOString(),
      knowledgePoint: suggestion.knowledgePoint,
      createdByAgentRun: suggestion.createdByAgentRun,
    })),
    agentRuns: draft.agentRuns.map((run) => ({
      id: run.id,
      agentName: run.agentName,
      toolName: run.toolName,
      model: run.model,
      status: run.status,
      confidence: run.confidence,
      accepted: run.accepted,
      input: toJsonValue(run.input) ?? {},
      output: toJsonValue(run.output),
      createdAt: run.createdAt.toISOString(),
    })),
  };
}

async function getDraft(id: string): Promise<DraftReviewWorkspaceDraft | null> {
  const draft = await prisma.questionDraft.findUnique({
    where: {
      id,
    },
    select: draftSelect,
  });

  if (!draft) {
    return null;
  }

  return toWorkspaceDraft(draft);
}

export default async function DraftReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = await getDraft(id);

  if (!draft) {
    notFound();
  }

  return <DraftReviewWorkspace draft={draft} />;
}
