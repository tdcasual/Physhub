type ExportOption = {
  label: string;
  value: string;
};

export type ExportableQuestion = {
  publicId: string;
  stemMd: string;
  optionsJson: unknown;
  answerJson: unknown;
  solutionMd?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptions(question: ExportableQuestion): ExportOption[] {
  if (!Array.isArray(question.optionsJson)) {
    return [];
  }

  return question.optionsJson.flatMap((option) => {
    if (
      !isRecord(option) ||
      typeof option.label !== "string" ||
      typeof option.value !== "string"
    ) {
      return [];
    }

    return [{ label: option.label, value: option.value }];
  });
}

function getAnswerText(question: ExportableQuestion) {
  if (!isRecord(question.answerJson)) {
    return "";
  }

  const value = question.answerJson.value;

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number => {
        return typeof item === "string" || typeof item === "number";
      })
      .join(", ");
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

export function renderQuestionToMarkdown(
  question: ExportableQuestion,
  teacher = true,
) {
  const optionText = getOptions(question)
    .map((option) => `${option.label}. ${option.value}`)
    .join("\n\n");
  const answer = getAnswerText(question);

  return [
    `<!-- ${question.publicId} -->`,
    question.stemMd,
    optionText,
    teacher && answer ? `答案：${answer}` : "",
    teacher && question.solutionMd ? `解析：\n${question.solutionMd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderQuestionToLatex(
  question: ExportableQuestion,
  teacher = true,
) {
  const choices = getOptions(question)
    .map((option) => `\\choice ${option.value}`)
    .join("\n");
  const answer = getAnswerText(question);
  const solution = [
    answer ? `答案：${answer}` : "",
    question.solutionMd ? `解析：\n${question.solutionMd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    `\\question ${question.stemMd}`,
    choices ? `\\begin{choices}\n${choices}\n\\end{choices}` : "",
    teacher && solution ? `\\begin{solution}\n${solution}\n\\end{solution}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
