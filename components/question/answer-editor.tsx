import type { EditableOption } from "./option-editor";

export type SingleAnswer = {
  type: "single";
  value: string;
};

type AnswerEditorProps = {
  answer: SingleAnswer;
  options: EditableOption[];
  onChange: (answer: SingleAnswer) => void;
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
      </div>
    </section>
  );
}
