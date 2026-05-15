import type { QuestionType } from "@prisma/client";

export type ParsedOption = {
  label: string;
  value: string;
};

export type ParsedSingleChoiceDraft = {
  type: QuestionType;
  stemMd: string;
  optionsJson?: ParsedOption[];
  answerJson?: {
    type: "single";
    value: string;
  };
  solutionMd?: string;
};

const optionLinePattern = /^\s*([A-Ha-h])\s*[.、]\s*(.+?)\s*$/;
const answerLinePattern = /^\s*答案\s*[：:]\s*([A-Ha-h])\s*$/;
const solutionLinePattern = /^\s*解析\s*[：:]\s*(.*?)\s*$/;

function compactLines(lines: string[]) {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseTextToDraft(text: string): ParsedSingleChoiceDraft {
  const stemLines: string[] = [];
  const solutionLines: string[] = [];
  const optionsJson: ParsedOption[] = [];
  let answerValue: string | undefined;
  let isReadingSolution = false;

  for (const line of text.split(/\r?\n/)) {
    const solutionMatch = line.match(solutionLinePattern);

    if (isReadingSolution && !solutionMatch) {
      solutionLines.push(line);
      continue;
    }

    const optionMatch = line.match(optionLinePattern);
    const answerMatch = line.match(answerLinePattern);

    if (optionMatch) {
      isReadingSolution = false;
      optionsJson.push({
        label: optionMatch[1].toUpperCase(),
        value: optionMatch[2].trim(),
      });
      continue;
    }

    if (answerMatch) {
      isReadingSolution = false;
      answerValue = answerMatch[1].toUpperCase();
      continue;
    }

    if (solutionMatch) {
      isReadingSolution = true;
      if (solutionMatch[1].trim().length > 0) {
        solutionLines.push(solutionMatch[1].trim());
      }
      continue;
    }

    stemLines.push(line);
  }

  const draft: ParsedSingleChoiceDraft = {
    type: "SINGLE_CHOICE",
    stemMd: compactLines(stemLines),
  };

  if (optionsJson.length > 0) {
    draft.optionsJson = optionsJson;
  }

  if (answerValue) {
    draft.answerJson = {
      type: "single",
      value: answerValue,
    };
  }

  const solutionMd = compactLines(solutionLines);

  if (solutionMd.length > 0) {
    draft.solutionMd = solutionMd;
  }

  return draft;
}
