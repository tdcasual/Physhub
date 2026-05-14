import { z } from "zod";
import { QuestionType } from "@prisma/client";

const questionTypeValues = Object.values(QuestionType) as [
  QuestionType,
  ...QuestionType[],
];

export const questionTypeSchema = z.enum(questionTypeValues);

export const optionSchema = z.object({
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const answerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single"),
    value: z.string().trim().min(1),
  }),
  z.object({
    type: z.literal("multiple"),
    value: z.array(z.string().trim().min(1)).min(1),
  }),
  z.object({
    type: z.literal("text"),
    value: z.string().trim().min(1),
  }),
]);

export const questionInputSchema = z.object({
  type: questionTypeSchema,
  stemMd: z.string().trim().min(1),
  options: z.array(optionSchema).optional(),
  answer: answerSchema,
  solutionMd: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  knowledgePointIds: z.array(z.string().trim().min(1)).min(1),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

const choiceTypes = new Set<QuestionInput["type"]>([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
]);

function addError(errors: Set<string>, message: string) {
  errors.add(message);
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAnswer(answer: Partial<QuestionInput>["answer"]) {
  if (!answer) {
    return false;
  }

  if (answer.type === "single" || answer.type === "text") {
    return hasText(answer.value);
  }

  if (answer.type === "multiple") {
    return answer.value.some(hasText);
  }

  return false;
}

function answerTypeMatchesQuestionType(input: Partial<QuestionInput>) {
  if (input.type === "SINGLE_CHOICE") {
    return input.answer?.type === "single";
  }

  if (input.type === "MULTIPLE_CHOICE") {
    return input.answer?.type === "multiple";
  }

  return true;
}

function answerMatchesOptions(input: Partial<QuestionInput>) {
  if (!input.type || !choiceTypes.has(input.type)) {
    return true;
  }

  if (!input.answer || !input.options?.length) {
    return true;
  }

  const optionLabels = new Set(input.options.map((option) => option.label));

  if (input.answer.type === "single") {
    return optionLabels.has(input.answer.value);
  }

  if (input.answer.type === "multiple") {
    return input.answer.value.every((value) => optionLabels.has(value));
  }

  return false;
}

export function validatePublishableQuestion(
  input: Partial<QuestionInput>,
): string[] {
  const errors = new Set<string>();

  if (!hasText(input.stemMd)) {
    addError(errors, "题干不能为空");
  }

  if (!input.type) {
    addError(errors, "必须确认题型");
  }

  if (!hasAnswer(input.answer)) {
    addError(errors, "必须填写答案");
  }

  if (!input.knowledgePointIds?.some(hasText)) {
    addError(errors, "必须确认知识点");
  }

  if (input.type && choiceTypes.has(input.type) && !input.options?.length) {
    addError(errors, "选择题必须有选项");
  }

  if (!answerTypeMatchesQuestionType(input) || !answerMatchesOptions(input)) {
    addError(errors, "答案必须匹配选项");
  }

  return [...errors];
}
