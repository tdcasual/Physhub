import type { EditableAnswer, EditableOption } from "@/lib/domain/editor-answer";

export type { EditableAnswer, EditableOption };
export type SingleAnswer = Extract<EditableAnswer, { type: "single" }>;

type AnswerEditorProps = {
  answer: EditableAnswer;
  options: EditableOption[];
  onChange: (answer: EditableAnswer) => void;
  disabled?: boolean;
};

export function AnswerEditor({
  answer,
  options,
  onChange,
  disabled = false,
}: AnswerEditorProps) {
  const hasOptions = options.length > 0;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Answer</h2>
      <div className="grid gap-3 border border-stone-900/15 bg-stone-50 p-3 sm:grid-cols-[10rem_1fr]">
        <label className="space-y-1 text-sm font-medium text-stone-900/70">
          Type
          <input
            value={answer.type}
            readOnly
            className="w-full border border-stone-900/20 bg-stone-100 px-3 py-2 text-stone-700"
          />
        </label>
        {answer.type === "single" ? (
          <label className="space-y-1 text-sm font-medium text-stone-900/70">
            Correct option
            <select
              value={answer.value}
              disabled={disabled || !hasOptions}
              onChange={(event) =>
                onChange({ type: "single", value: event.currentTarget.value })
              }
              className="w-full border border-stone-900/20 bg-white px-3 py-2 text-stone-950 disabled:bg-stone-100"
            >
              {options.map((option, index) => (
                <option key={`${index}-${option.label}`} value={option.label}>
                  {option.label}
                </option>
              ))}
              {!hasOptions ? <option value="">No complete options</option> : null}
            </select>
          </label>
        ) : null}
        {answer.type === "multiple" ? (
          <fieldset className="space-y-2" disabled={disabled || !hasOptions}>
            <legend className="text-sm font-medium text-stone-900/70">
              Correct options
            </legend>
            {hasOptions ? (
              <ul className="space-y-1">
                {options.map((option, index) => (
                  <li key={`${index}-${option.label}`}>
                    <label className="flex items-center gap-2 text-sm">
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
              <p className="text-sm text-stone-900/65">No complete options</p>
            )}
          </fieldset>
        ) : null}
        {answer.type === "text" ? (
          <label className="space-y-1 text-sm font-medium text-stone-900/70">
            Answer text
            <textarea
              value={answer.value}
              disabled={disabled}
              onChange={(event) =>
                onChange({ type: "text", value: event.currentTarget.value })
              }
              rows={4}
              className="w-full border border-stone-900/20 bg-white px-3 py-2 text-sm text-stone-950 disabled:bg-stone-100"
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
