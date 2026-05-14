import type { QuestionInput } from "@/lib/domain/question-schema";

export function buildPublicQuestionId(
  topicSlug: string,
  sequence: number,
): string {
  return `q_${topicSlug}_${sequence.toString().padStart(4, "0")}`;
}

export function normalizeQuestionInput(input: QuestionInput): QuestionInput {
  return {
    ...input,
    stemMd: input.stemMd.trim(),
    solutionMd: input.solutionMd?.trim(),
    options: input.options?.map((option) => ({
      label: option.label.trim().toUpperCase(),
      value: option.value.trim(),
    })),
  };
}
