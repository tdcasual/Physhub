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

const BLOCKED_LATEX_COMMANDS = [
  "input",
  "include",
  "write18",
  "openout",
  "read",
  "catcode",
  "usepackage",
  "documentclass",
] as const;

const BLOCKED_LATEX_ENVIRONMENTS = ["document", "questions"] as const;

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

function sanitizeLatexExportText(value: string) {
  // Source content is Markdown + LaTeX, so safe math commands such as \frac
  // must survive export. This MVP policy deterministically replaces only
  // dangerous execution/preamble/document-structure commands that could break
  // or escape the generated question environment.
  let sanitized = value;

  for (const command of BLOCKED_LATEX_COMMANDS) {
    sanitized = sanitized.replace(
      new RegExp(`\\\\${command}\\b`, "gi"),
      `[blocked LaTeX command: ${command}]`,
    );
  }

  for (const environment of BLOCKED_LATEX_ENVIRONMENTS) {
    sanitized = sanitized.replace(
      new RegExp(`\\\\(begin|end)\\s*\\{\\s*${environment}\\s*\\}`, "gi"),
      (_match, boundary: string) =>
        `[blocked LaTeX command: ${boundary}{${environment}}]`,
    );
  }

  return sanitized;
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
    .map((option) => `\\choice ${sanitizeLatexExportText(option.value)}`)
    .join("\n");
  const answer = sanitizeLatexExportText(getAnswerText(question));
  const solutionMd = question.solutionMd
    ? sanitizeLatexExportText(question.solutionMd)
    : "";
  const solution = [
    answer ? `答案：${answer}` : "",
    solutionMd ? `解析：\n${solutionMd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    `\\question ${sanitizeLatexExportText(question.stemMd)}`,
    choices ? `\\begin{choices}\n${choices}\n\\end{choices}` : "",
    teacher && solution ? `\\begin{solution}\n${solution}\n\\end{solution}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
