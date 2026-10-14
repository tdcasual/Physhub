export type EditableOption = {
  label: string;
  value: string;
};

type OptionEditorProps = {
  options: EditableOption[];
  onChange: (options: EditableOption[]) => void;
  disabled?: boolean;
};

const nextLabels = ["A", "B", "C", "D", "E", "F"];

export function OptionEditor({
  options,
  onChange,
  disabled = false,
}: OptionEditorProps) {
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
        <h2 className="font-serif text-lg font-semibold">选项</h2>
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="inline-flex min-h-11 items-center border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 text-sm font-medium hover:bg-[var(--paper-mute)] disabled:opacity-50"
        >
          加选项
        </button>
      </div>

      <div className="space-y-3">
        {options.map((option, index) => {
          const rowLabel = option.label.trim() || `第 ${index + 1} 行`;

          return (
            <div
              key={`${option.label}-${index}`}
              className="grid gap-2 border border-[var(--ink-border)] bg-[var(--paper-mute)] p-3 sm:grid-cols-[5rem_1fr_auto]"
            >
              <label className="space-y-1 text-sm font-medium text-[var(--ink-soft)]">
                <span>选项标记</span>
                <input
                  aria-label={`选项 ${index + 1} 标记`}
                  value={option.label}
                  disabled={disabled}
                  onChange={(event) =>
                    updateOption(index, "label", event.currentTarget.value)
                  }
                  className="w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--ink-soft)]">
                <span>选项内容</span>
                <textarea
                  aria-label={`选项 ${index + 1} ${rowLabel} 内容`}
                  value={option.value}
                  disabled={disabled}
                  onChange={(event) =>
                    updateOption(index, "value", event.currentTarget.value)
                  }
                  rows={2}
                  className="w-full resize-y border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
                />
              </label>
              <button
                type="button"
                aria-label={`删除该选项 ${index + 1}（${rowLabel}）`}
                onClick={() => removeOption(index)}
                disabled={disabled}
                className="inline-flex min-h-11 items-center self-end border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 text-sm font-medium text-[var(--ink-soft)] hover:bg-[var(--paper-mute)] disabled:opacity-50"
              >
                删除该选项
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
