"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RawAssetUpload } from "@/components/raw-asset/raw-asset-upload";
import { QuestionPreview } from "./question-preview";
import { AnswerEditor, type SingleAnswer } from "./answer-editor";
import { OptionEditor, type EditableOption } from "./option-editor";

const initialOptions: EditableOption[] = [
  { label: "A", value: "物体一直做匀速直线运动" },
  { label: "B", value: "物体先做匀加速运动，后做匀速运动" },
  { label: "C", value: "物体的加速度一直增大" },
  { label: "D", value: "物体在 $t=2\\text{s}$ 时回到出发点" },
];

const initialStem = `如图所示为某物体做直线运动的 $v-t$ 图像。下列说法正确的是（ ）

图像信息：$0-2\\text{s}$ 内速度由 $0$ 均匀增大到 $4\\text{m/s}$，$2-4\\text{s}$ 内速度保持 $4\\text{m/s}$ 不变。`;

const initialSolution = `由 $v-t$ 图像可知，$0-2\\text{s}$ 内速度均匀增大，物体做匀加速直线运动；$2-4\\text{s}$ 内速度保持不变，物体做匀速直线运动。因此选 B。`;

function isCompleteOption(option: EditableOption) {
  return option.label.trim().length > 0 && option.value.trim().length > 0;
}

function validOptions(options: EditableOption[]) {
  return options
    .filter(isCompleteOption)
    .map((option) => ({ label: option.label.trim(), value: option.value }));
}

function alignAnswerValue(
  previousOptions: EditableOption[],
  nextOptions: EditableOption[],
  answerValue: string,
) {
  const nextValidOptions = validOptions(nextOptions);

  if (nextValidOptions.some((option) => option.label === answerValue)) {
    return answerValue;
  }

  const previousSelectedIndex = previousOptions.findIndex(
    (option) => isCompleteOption(option) && option.label.trim() === answerValue,
  );
  const nextOptionAtSelectedIndex = nextOptions[previousSelectedIndex];

  if (
    previousOptions.length === nextOptions.length &&
    nextOptionAtSelectedIndex &&
    isCompleteOption(nextOptionAtSelectedIndex)
  ) {
    return nextOptionAtSelectedIndex.label.trim();
  }

  return nextValidOptions[0]?.label ?? "";
}

export function QuestionEditor() {
  const router = useRouter();
  const [stemMd, setStemMd] = useState(initialStem);
  const [options, setOptions] = useState(initialOptions);
  const [answer, setAnswer] = useState<SingleAnswer>({
    type: "single",
    value: "B",
  });
  const [solutionMd, setSolutionMd] = useState(initialSolution);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceRawAssetId, setSourceRawAssetId] = useState<string | null>(null);

  const previewOptions = useMemo(() => validOptions(options), [options]);

  async function handleSaveAsDraft() {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "SINGLE_CHOICE",
          stemMd,
          options: previewOptions,
          answer,
          solutionMd,
          ...(sourceRawAssetId ? { sourceRawAssetId } : {}),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        draft?: { id?: string };
      };

      if (!response.ok || !payload.draft?.id) {
        setSaveError(payload.error ?? "Unable to save draft");
        return;
      }

      router.push(`/drafts/${payload.draft.id}`);
    } catch {
      setSaveError("Unable to save draft");
    } finally {
      setSaving(false);
    }
  }

  function handleOptionsChange(nextOptions: EditableOption[]) {
    const nextAnswerValue = alignAnswerValue(options, nextOptions, answer.value);

    setOptions(nextOptions);
    if (nextAnswerValue !== answer.value) {
      setAnswer({ type: "single", value: nextAnswerValue });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)] lg:px-10">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-800">
            Draft workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Manual Question Editor</h1>
          <p className="mt-3 max-w-2xl leading-7 text-stone-900/70">
            Edit the question Markdown, options, answer contract, and solution
            while checking the rendered teacher-facing preview.
          </p>
        </div>

        <label className="block space-y-2 text-sm font-medium text-stone-900/70">
          Stem Markdown
          <textarea
            value={stemMd}
            onChange={(event) => setStemMd(event.currentTarget.value)}
            rows={8}
            className="w-full resize-y border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm text-stone-950 shadow-sm"
          />
        </label>

        <RawAssetUpload onUploaded={setSourceRawAssetId} />

        <OptionEditor options={options} onChange={handleOptionsChange} />

        <AnswerEditor answer={answer} options={previewOptions} onChange={setAnswer} />

        <label className="block space-y-2 text-sm font-medium text-stone-900/70">
          Solution Markdown
          <textarea
            value={solutionMd}
            onChange={(event) => setSolutionMd(event.currentTarget.value)}
            rows={6}
            className="w-full resize-y border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm text-stone-950 shadow-sm"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSaveAsDraft();
            }}
            disabled={saving}
            className="border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save as draft
          </button>
          {saveError ? (
            <p className="text-sm text-red-800">{saveError}</p>
          ) : null}
        </div>

        <section className="border border-stone-900/15 bg-stone-50 p-4">
          <h2 className="text-lg font-semibold">JSON Contract</h2>
          <pre className="mt-3 overflow-auto bg-white p-3 text-xs leading-6 text-stone-800">
            {JSON.stringify({ options: previewOptions, answer }, null, 2)}
          </pre>
        </section>
      </section>

      <aside
        aria-labelledby="question-preview-heading"
        className="space-y-3 lg:sticky lg:top-6 lg:self-start"
        role="region"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
            Renderer check
          </p>
          <h2 id="question-preview-heading" className="mt-2 text-2xl font-semibold">
            Live Preview
          </h2>
        </div>
        <QuestionPreview
          stemMd={stemMd}
          options={previewOptions}
          solutionMd={solutionMd}
          showSolution
        />
      </aside>
    </div>
  );
}
