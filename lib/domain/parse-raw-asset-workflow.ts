import { prisma } from "@/lib/db/prisma";
import {
  parseTextToDraft,
  type ParsedSingleChoiceDraft,
} from "@/lib/workers/mock-parse-worker";

type RawAssetRecord = {
  id: string;
  textContent: string | null;
};

type DraftRecord = {
  id: string;
};

type ParseJobRecord = {
  id: string;
};

type ParseWorkflowDb = {
  rawAsset: {
    findUnique(input: { where: { id: string } }): Promise<RawAssetRecord | null>;
    update(input: {
      where: { id: string };
      data: { status: "PROCESSING" | "PARSED" | "FAILED" };
    }): Promise<unknown>;
  };
  parseJob: {
    create(input: {
      data: {
        rawAssetId: string;
        status: "RUNNING";
        jobType: "mock_parse_text";
        input: { rawAssetId: string };
      };
    }): Promise<ParseJobRecord>;
    update(input: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  questionDraft: {
    create(input: {
      data: {
        status: "NEEDS_REVIEW";
        type: ParsedSingleChoiceDraft["type"];
        stemMd: string;
        optionsJson?: ParsedSingleChoiceDraft["optionsJson"];
        answerJson?: ParsedSingleChoiceDraft["answerJson"];
        solutionMd: string | null;
        sourceRawAssetId: string;
        aiOutput: ParsedSingleChoiceDraft;
      };
    }): Promise<DraftRecord>;
  };
  agentRun: {
    create(input: {
      data: {
        agentName: "mock-structure-agent";
        toolName: "create_question_draft";
        status: "SUCCEEDED";
        input: { rawAssetId: string };
        output: ParsedSingleChoiceDraft;
        draftId: string;
      };
    }): Promise<unknown>;
  };
};

type ParseRawAssetWorkflowInput = {
  db: ParseWorkflowDb;
  rawAssetId: string;
  parseTextToDraft: (text: string) => ParsedSingleChoiceDraft;
};

export type ParseRawAssetWorkflowResult =
  | { status: "created"; draft: DraftRecord }
  | { status: "not_found" }
  | { status: "failed" };

function serializeRawError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function parseRawAssetWithClient({
  db,
  rawAssetId,
  parseTextToDraft,
}: ParseRawAssetWorkflowInput): Promise<ParseRawAssetWorkflowResult> {
  const rawAsset = await db.rawAsset.findUnique({
    where: { id: rawAssetId },
  });

  if (!rawAsset) {
    return { status: "not_found" };
  }

  const parseJob = await db.parseJob.create({
    data: {
      rawAssetId: rawAsset.id,
      status: "RUNNING",
      jobType: "mock_parse_text",
      input: {
        rawAssetId: rawAsset.id,
      },
    },
  });

  let failedStep = "mark_processing";

  try {
    await db.rawAsset.update({
      where: { id: rawAsset.id },
      data: { status: "PROCESSING" },
    });

    failedStep = "parse_text";
    const parsed = parseTextToDraft(rawAsset.textContent ?? "");

    failedStep = "create_draft";
    const questionDraft = await db.questionDraft.create({
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

    failedStep = "create_agent_run";
    await db.agentRun.create({
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

    // Sequential on purpose: ParseJob.failedStep is the audit if a later write
    // throws. $transaction would expand ParseWorkflowDb (the test double) for
    // an opt-in fixture, not product OCR.
    failedStep = "update_parse_job_succeeded";
    await db.parseJob.update({
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

    failedStep = "mark_parsed";
    await db.rawAsset.update({
      where: { id: rawAsset.id },
      data: { status: "PARSED" },
    });

    return {
      status: "created",
      draft: questionDraft,
    };
  } catch (error) {
    try {
      await db.parseJob.update({
        where: {
          id: parseJob.id,
        },
        data: {
          status: "FAILED",
          errorCode: "PARSE_WORKFLOW_FAILED",
          errorMessage: "Failed to parse raw asset",
          rawError: serializeRawError(error),
          failedStep,
        },
      });
    } catch {
      // Keep flipping the asset even if the job row cannot be updated.
    }

    await db.rawAsset.update({
      where: { id: rawAsset.id },
      data: { status: "FAILED" },
    });

    return { status: "failed" };
  }
}

export function parseRawAsset(rawAssetId: string) {
  return parseRawAssetWithClient({
    db: prisma,
    rawAssetId,
    parseTextToDraft,
  });
}
