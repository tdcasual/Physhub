import { describe, expect, it, vi } from "vitest";

import { parseRawAssetWithClient } from "@/lib/domain/parse-raw-asset-workflow";
import type { ParsedSingleChoiceDraft } from "@/lib/workers/mock-parse-worker";

function buildDb(overrides: Record<string, unknown> = {}) {
  return {
    rawAsset: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    parseJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
    questionDraft: {
      create: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
    },
    ...overrides,
  };
}

const parsedDraft: ParsedSingleChoiceDraft = {
  type: "SINGLE_CHOICE",
  stemMd: "题干",
  optionsJson: [{ label: "A", value: "甲" }],
  answerJson: { type: "single", value: "A" },
  solutionMd: "解析",
};

describe("parseRawAssetWithClient", () => {
  it("returns not_found without creating a parse job when the raw asset is missing", async () => {
    const db = buildDb();
    db.rawAsset.findUnique.mockResolvedValue(null);

    const result = await parseRawAssetWithClient({
      db,
      rawAssetId: "missing",
      parseTextToDraft: vi.fn(),
    });

    expect(result).toEqual({ status: "not_found" });
    expect(db.rawAsset.findUnique).toHaveBeenCalledWith({
      where: { id: "missing" },
    });
    expect(db.parseJob.create).not.toHaveBeenCalled();
    expect(db.rawAsset.update).not.toHaveBeenCalled();
  });

  it("creates a running job, draft, agent run, and marks the job succeeded", async () => {
    const db = buildDb();
    db.rawAsset.findUnique.mockResolvedValue({
      id: "raw_1",
      textContent: "raw text",
    });
    db.parseJob.create.mockResolvedValue({ id: "job_1" });
    db.questionDraft.create.mockResolvedValue({ id: "draft_1" });
    const parseTextToDraft = vi.fn().mockReturnValue(parsedDraft);

    const result = await parseRawAssetWithClient({
      db,
      rawAssetId: "raw_1",
      parseTextToDraft,
    });

    expect(result).toEqual({
      status: "created",
      draft: { id: "draft_1" },
    });
    expect(db.parseJob.create).toHaveBeenCalledWith({
      data: {
        rawAssetId: "raw_1",
        status: "RUNNING",
        jobType: "mock_parse_text",
        input: { rawAssetId: "raw_1" },
      },
    });
    expect(parseTextToDraft).toHaveBeenCalledWith("raw text");
    expect(db.questionDraft.create).toHaveBeenCalledWith({
      data: {
        status: "NEEDS_REVIEW",
        type: "SINGLE_CHOICE",
        stemMd: "题干",
        optionsJson: [{ label: "A", value: "甲" }],
        answerJson: { type: "single", value: "A" },
        solutionMd: "解析",
        sourceRawAssetId: "raw_1",
        aiOutput: parsedDraft,
      },
    });
    expect(db.agentRun.create).toHaveBeenCalledWith({
      data: {
        agentName: "mock-structure-agent",
        toolName: "create_question_draft",
        status: "SUCCEEDED",
        input: { rawAssetId: "raw_1" },
        output: parsedDraft,
        draftId: "draft_1",
      },
    });
    expect(db.parseJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: {
        status: "SUCCEEDED",
        output: { draftId: "draft_1" },
      },
    });
    expect(db.rawAsset.update.mock.calls).toEqual([
      [{ where: { id: "raw_1" }, data: { status: "PROCESSING" } }],
      [{ where: { id: "raw_1" }, data: { status: "PARSED" } }],
    ]);
  });

  it("marks an existing parse job failed when parsing fails", async () => {
    const db = buildDb();
    db.rawAsset.findUnique.mockResolvedValue({
      id: "raw_1",
      textContent: "raw text",
    });
    db.parseJob.create.mockResolvedValue({ id: "job_1" });
    const parseError = new Error("parser exploded");

    const result = await parseRawAssetWithClient({
      db,
      rawAssetId: "raw_1",
      parseTextToDraft: vi.fn(() => {
        throw parseError;
      }),
    });

    expect(result).toEqual({ status: "failed" });
    expect(db.parseJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: expect.objectContaining({
        status: "FAILED",
        errorCode: "PARSE_WORKFLOW_FAILED",
        errorMessage: "Failed to parse raw asset",
        failedStep: "parse_text",
      }),
    });
    expect(db.parseJob.update.mock.calls[0][0].data.rawError).toContain(
      "parser exploded",
    );
    expect(db.rawAsset.update.mock.calls).toEqual([
      [{ where: { id: "raw_1" }, data: { status: "PROCESSING" } }],
      [{ where: { id: "raw_1" }, data: { status: "FAILED" } }],
    ]);
  });

  it("marks the raw asset failed even if recording the parse job failure throws", async () => {
    const db = buildDb();
    db.rawAsset.findUnique.mockResolvedValue({
      id: "raw_1",
      textContent: "raw text",
    });
    db.parseJob.create.mockResolvedValue({ id: "job_1" });
    db.parseJob.update.mockRejectedValue(new Error("job update exploded"));

    const result = await parseRawAssetWithClient({
      db,
      rawAssetId: "raw_1",
      parseTextToDraft: vi.fn(() => {
        throw new Error("parser exploded");
      }),
    });

    expect(result).toEqual({ status: "failed" });
    expect(db.rawAsset.update.mock.calls).toEqual([
      [{ where: { id: "raw_1" }, data: { status: "PROCESSING" } }],
      [{ where: { id: "raw_1" }, data: { status: "FAILED" } }],
    ]);
  });
});
