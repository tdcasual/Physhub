import { z } from "zod";

import {
  answerSchema,
  optionSchema,
  questionTypeSchema,
} from "@/lib/domain/question-schema";

export const questionDraftFieldSchema = z.object({
  type: questionTypeSchema.optional(),
  stemMd: z.string().optional(),
  options: z.array(optionSchema).optional(),
  answer: answerSchema.optional(),
  solutionMd: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  knowledgePointIds: z.array(z.string().trim().min(1)).optional(),
  tagIds: z.array(z.string().trim().min(1)).optional(),
  sourceRawAssetId: z.string().trim().min(1).optional(),
});

export const questionDraftInputSchema = questionDraftFieldSchema.extend({
  // Agent PATCH only: unidirectional DRAFT → NEEDS_REVIEW. Create always stays DRAFT.
  status: z.enum(["NEEDS_REVIEW"]).optional(),
});

export const humanQuestionDraftStatusSchema = z.enum([
  "DRAFT",
  "NEEDS_REVIEW",
  "REJECTED",
]);

export const humanQuestionDraftInputSchema = questionDraftFieldSchema.extend({
  status: humanQuestionDraftStatusSchema.optional(),
});

export type QuestionDraftInput = z.infer<typeof questionDraftInputSchema>;
export type HumanQuestionDraftInput = z.infer<
  typeof humanQuestionDraftInputSchema
>;
export type QuestionDraftWriteInput = Omit<HumanQuestionDraftInput, "status"> & {
  status?: "DRAFT" | "NEEDS_REVIEW" | "REJECTED";
};

function isAbsent(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function omitAbsentDraftFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const body = { ...(raw as Record<string, unknown>) };
  const absentableKeys = [
    "type",
    "stemMd",
    "options",
    "answer",
    "solutionMd",
    "difficulty",
    "knowledgePointIds",
    "tagIds",
    "sourceRawAssetId",
    "status",
  ] as const;

  for (const key of absentableKeys) {
    if (!(key in body)) {
      continue;
    }

    if (key === "stemMd" || key === "solutionMd") {
      if (body[key] === null) {
        delete body[key];
      }
      continue;
    }

    if (isAbsent(body[key])) {
      delete body[key];
    }
  }

  return body;
}

export type ParsedDraftInput<T> =
  | { success: true; data: T }
  | { success: false; invalidStatus: boolean; message: string };

function toParseFailure(
  error: z.ZodError,
): Extract<ParsedDraftInput<never>, { success: false }> {
  const invalidStatus = error.issues.some((issue) => issue.path[0] === "status");

  return {
    success: false,
    invalidStatus,
    message: invalidStatus
      ? "Invalid draft status"
      : error.issues.map((issue) => issue.message).join("; "),
  };
}

export function parseAgentQuestionDraftInput(
  raw: unknown,
): ParsedDraftInput<QuestionDraftInput> {
  const parsed = questionDraftInputSchema.safeParse(omitAbsentDraftFields(raw));

  if (!parsed.success) {
    return toParseFailure(parsed.error);
  }

  return { success: true, data: parsed.data };
}

export function parseHumanQuestionDraftInput(
  raw: unknown,
): ParsedDraftInput<HumanQuestionDraftInput> {
  const parsed = humanQuestionDraftInputSchema.safeParse(
    omitAbsentDraftFields(raw),
  );

  if (!parsed.success) {
    return toParseFailure(parsed.error);
  }

  return { success: true, data: parsed.data };
}
