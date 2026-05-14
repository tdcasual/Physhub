import type { QuestionInput } from "@/lib/domain/question-schema";

const topicSlugPattern = /^[a-z0-9_]+$/;

export function buildPublicQuestionId(
  topicSlug: string,
  sequence: number,
): string {
  if (!topicSlugPattern.test(topicSlug)) {
    throw new Error(
      "topicSlug must contain only lowercase letters, numbers, and underscores",
    );
  }

  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("sequence must be a positive integer");
  }

  return `q_${topicSlug}_${sequence.toString().padStart(4, "0")}`;
}

function normalizeChoiceLabel(label: string): string {
  return label.trim().toUpperCase();
}

function normalizeAnswer(answer: QuestionInput["answer"]): QuestionInput["answer"] {
  if (answer.type === "single") {
    return {
      ...answer,
      value: normalizeChoiceLabel(answer.value),
    };
  }

  if (answer.type === "multiple") {
    return {
      ...answer,
      value: answer.value.map(normalizeChoiceLabel),
    };
  }

  return {
    ...answer,
    value: answer.value.trim(),
  };
}

export function normalizeQuestionInput(input: QuestionInput): QuestionInput {
  return {
    ...input,
    stemMd: input.stemMd.trim(),
    solutionMd: input.solutionMd?.trim(),
    options: input.options?.map((option) => ({
      label: normalizeChoiceLabel(option.label),
      value: option.value.trim(),
    })),
    answer: normalizeAnswer(input.answer),
  };
}
