export type EditableOption = {
  label: string;
  value: string;
};

type OptionEditorProps = {
  options: EditableOption[];
  onChange: (options: EditableOption[]) => void;
};

const nextLabels = ["A", "B", "C", "D", "E", "F"];

export function OptionEditor({ options, onChange }: OptionEditorProps) {
  function updateOption(index: number, field: keyof EditableOption, value: string) {
    onChange(
      options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      ),
    );
  }

  function addOption() {
    const nextLabel = nextLabels[options.length] ?? String(options.length + 1);
    onChange([...options, { label: nextLabel, value: "" }]);
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Options</h2>
        <button
          type="button"
          onClick={addOption}
          className="border border-stone-900/20 bg-white px-3 py-2 text-sm font-medium hover:bg-sky-50"
        >
          Add option
        </button>
      </div>

      <div className="space-y-3">
        {options.map((option, index) => (
          <div
            key={`${option.label}-${index}`}
            className="grid gap-2 border border-stone-900/15 bg-stone-50 p-3 sm:grid-cols-[5rem_1fr_auto]"
          >
            <label className="space-y-1 text-sm font-medium text-stone-900/70">
              Label
              <input
                value={option.label}
                onChange={(event) =>
                  updateOption(index, "label", event.currentTarget.value)
                }
                className="w-full border border-stone-900/20 bg-white px-3 py-2 text-stone-950"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-stone-900/70">
              Value Markdown
              <textarea
                value={option.value}
                onChange={(event) =>
                  updateOption(index, "value", event.currentTarget.value)
                }
                rows={2}
                className="w-full resize-y border border-stone-900/20 bg-white px-3 py-2 text-stone-950"
              />
            </label>
            <button
              type="button"
              onClick={() => removeOption(index)}
              className="self-end border border-stone-900/20 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-orange-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
