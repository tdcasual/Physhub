import type { QuestionType } from "@prisma/client";

export type EditableOption = {
  label: string;
  value: string;
};

export type EditableAnswer =
  | { type: "single"; value: string }
  | { type: "multiple"; value: string[] }
  | { type: "text"; value: string };

export const DEFAULT_CHOICE_OPTIONS: EditableOption[] = [
  { label: "A", value: "物体一直做匀速直线运动" },
  { label: "B", value: "物体先做匀加速运动，后做匀速运动" },
  { label: "C", value: "物体的加速度一直增大" },
  { label: "D", value: "物体在 $t=2\\text{s}$ 时回到出发点" },
];

export function isChoiceType(
  type: QuestionType | "" | null | undefined,
): type is "SINGLE_CHOICE" | "MULTIPLE_CHOICE" {
  return type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";
}

export function defaultAnswerForType(
  type: QuestionType | "" | null | undefined,
  options: Array<{ label: string }>,
  previous?: EditableAnswer,
): EditableAnswer {
  if (type === "MULTIPLE_CHOICE") {
    if (previous?.type === "multiple") {
      return previous;
    }

    if (previous?.type === "single" && previous.value) {
      return { type: "multiple", value: [previous.value] };
    }

    return { type: "multiple", value: [] };
  }

  if (type === "SINGLE_CHOICE" || type == null || type === "") {
    if (previous?.type === "single") {
      return previous;
    }

    if (previous?.type === "multiple") {
      return {
        type: "single",
        value: previous.value[0] ?? options[0]?.label ?? "",
      };
    }

    return { type: "single", value: options[0]?.label ?? "" };
  }

  if (previous?.type === "text") {
    return previous;
  }

  return { type: "text", value: "" };
}

export function optionsAfterTypeChange(
  type: QuestionType | "" | null | undefined,
  options: EditableOption[],
): EditableOption[] {
  if (isChoiceType(type) && options.length === 0) {
    return DEFAULT_CHOICE_OPTIONS.map((option) => ({ ...option }));
  }

  return options;
}

export function parseIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

export function parseEditableAnswer(
  value: unknown,
  type?: QuestionType | "" | null,
): EditableAnswer {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (record.type === "single" && typeof record.value === "string") {
      return { type: "single", value: record.value };
    }

    if (record.type === "multiple" && Array.isArray(record.value)) {
      return {
        type: "multiple",
        value: record.value.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        ),
      };
    }

    if (record.type === "text" && typeof record.value === "string") {
      return { type: "text", value: record.value };
    }
  }

  return defaultAnswerForType(type ?? null, []);
}
