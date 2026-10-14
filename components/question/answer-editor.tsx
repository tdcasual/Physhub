import type { EditableAnswer, EditableOption } from "@/lib/domain/editor-answer";

export type { EditableAnswer, EditableOption };
export type SingleAnswer = Extract<EditableAnswer, { type: "single" }>;

type AnswerEditorProps = {
  answer: EditableAnswer;
  options: EditableOption[];
  onChange: (answer: EditableAnswer) => void;
  disabled?: boolean;
};

function answerTypeLabel(type: EditableAnswer["type"]) {
  if (type === "single") {
    return "单选";
  }

  if (type === "multiple") {
    return "多选";
  }

  return "文本";
}

export function AnswerEditor({
  answer,
  options,
  onChange,
  disabled = false,
}: AnswerEditorProps) {
  const hasOptions = options.length > 0;

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-semibold">答案</h2>
      <div className="grid gap-3 border border-[var(--ink-border)] bg-[var(--paper-mute)] p-3 sm:grid-cols-[10rem_1fr]">
        <label className="space-y-1 text-sm font-medium text-[var(--ink-soft)]">
          答案类型
          <input
            value={answerTypeLabel(answer.type)}
            readOnly
            className="w-full border border-[var(--ink-border)] bg-[var(--paper-mute)] px-3 py-2 text-[var(--ink-soft)]"
          />
        </label>
        {answer.type === "single" ? (
          <label className="space-y-1 text-sm font-medium text-[var(--ink-soft)]">
            正确选项
            <select
              value={answer.value}
              disabled={disabled || !hasOptions}
              onChange={(event) =>
                onChange({ type: "single", value: event.currentTarget.value })
              }
              className="w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
            >
              {options.map((option, index) => (
                <option key={`${index}-${option.label}`} value={option.label}>
                  {option.label}
                </option>
              ))}
              {!hasOptions ? <option value="">暂无完整选项</option> : null}
            </select>
          </label>
        ) : null}
        {answer.type === "multiple" ? (
          <fieldset className="space-y-2" disabled={disabled || !hasOptions}>
            <legend className="text-sm font-medium text-[var(--ink-soft)]">
              正确选项
            </legend>
            {hasOptions ? (
              <ul className="space-y-1">
                {options.map((option, index) => (
                  <li key={`${index}-${option.label}`}>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={answer.value.includes(option.label)}
                        onChange={() => {
                          const next = answer.value.includes(option.label)
                            ? answer.value.filter((label) => label !== option.label)
                            : [...answer.value, option.label];
                          onChange({ type: "multiple", value: next });
                        }}
                      />
                      <span>{option.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ink-faint)]">暂无完整选项</p>
            )}
          </fieldset>
        ) : null}
        {answer.type === "text" ? (
          <label className="space-y-1 text-sm font-medium text-[var(--ink-soft)]">
            答案文本
            <textarea
              value={answer.value}
              disabled={disabled}
              onChange={(event) =>
                onChange({ type: "text", value: event.currentTarget.value })
              }
              rows={4}
              className="w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-sm text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
