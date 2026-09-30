"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuestionType } from "@prisma/client";

import { RawAssetUpload } from "@/components/raw-asset/raw-asset-upload";
import { TaxonomyFields } from "@/components/taxonomy/taxonomy-fields";
import {
  DEFAULT_CHOICE_OPTIONS,
  defaultAnswerForType,
  isChoiceType,
  optionsAfterTypeChange,
  type EditableAnswer,
  type EditableOption,
} from "@/lib/domain/editor-answer";
import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";
import { TechDetails } from "@/components/ui/tech-details";
import { QuestionPreview } from "./question-preview";
import { AnswerEditor } from "./answer-editor";
import { OptionEditor } from "./option-editor";

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

export function QuestionEditor({
  knowledgePoints,
  tags,
}: {
  knowledgePoints: KnowledgePointDto[];
  tags: TagDto[];
}) {
  const router = useRouter();
  const [stemMd, setStemMd] = useState(initialStem);
  const [options, setOptions] = useState(DEFAULT_CHOICE_OPTIONS);
  const [answer, setAnswer] = useState<EditableAnswer>({
    type: "single",
    value: "B",
  });
  const [solutionMd, setSolutionMd] = useState(initialSolution);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sourceRawAssetId, setSourceRawAssetId] = useState<string | null>(null);
  const [type, setType] = useState<QuestionType | "">("SINGLE_CHOICE");
  const [knowledgePointIds, setKnowledgePointIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<number | null>(null);

  const previewOptions = useMemo(() => validOptions(options), [options]);
  const showOptions = isChoiceType(type) || type === "";

  async function handleSaveAsDraft() {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(type ? { type } : {}),
          stemMd,
          ...(showOptions ? { options: previewOptions } : {}),
          answer,
          solutionMd,
          knowledgePointIds,
          tagIds,
          ...(typeof difficulty === "number" ? { difficulty } : {}),
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
    setOptions(nextOptions);

    if (answer.type === "single") {
      const nextAnswerValue = alignAnswerValue(options, nextOptions, answer.value);
      if (nextAnswerValue !== answer.value) {
        setAnswer({ type: "single", value: nextAnswerValue });
      }
      return;
    }

    if (answer.type === "multiple") {
      const labels = new Set(validOptions(nextOptions).map((option) => option.label));
      setAnswer({
        type: "multiple",
        value: answer.value.filter((label) => labels.has(label)),
      });
    }
  }

  function handleTaxonomyChange(next: {
    knowledgePointIds: string[];
    tagIds: string[];
    difficulty: number | null;
    type: QuestionType | "";
  }) {
    setKnowledgePointIds(next.knowledgePointIds);
    setTagIds(next.tagIds);
    setDifficulty(next.difficulty);
    setType(next.type);
    const nextOptions = optionsAfterTypeChange(next.type, options);
    setOptions(nextOptions);
    setAnswer(defaultAnswerForType(next.type, validOptions(nextOptions), answer));
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)] lg:px-10">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium text-[var(--patina)]">手录</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">录入试题</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--ink-soft)]">
            填写题干、选项、答案和解析，右侧是学生卷面预览。
          </p>
        </div>

        <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
          题干
          <textarea
            value={stemMd}
            onChange={(event) => setStemMd(event.currentTarget.value)}
            rows={8}
            className="w-full resize-y border border-[var(--ink-border)] bg-[var(--paper-raised)] px-4 py-3 text-sm text-[var(--ink)]"
          />
        </label>

        <RawAssetUpload onUploaded={setSourceRawAssetId} />

        <TaxonomyFields
          knowledgePoints={knowledgePoints}
          tags={tags}
          value={{ knowledgePointIds, tagIds, difficulty, type }}
          onChange={handleTaxonomyChange}
        />

        {showOptions ? (
          <OptionEditor options={options} onChange={handleOptionsChange} />
        ) : null}

        <AnswerEditor
          answer={answer}
          options={previewOptions}
          onChange={setAnswer}
        />

        <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
          解析
          <textarea
            value={solutionMd}
            onChange={(event) => setSolutionMd(event.currentTarget.value)}
            rows={6}
            className="w-full resize-y border border-[var(--ink-border)] bg-[var(--paper-raised)] px-4 py-3 text-sm text-[var(--ink)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSaveAsDraft();
            }}
            disabled={saving}
            className="inline-flex min-h-11 items-center border border-[var(--seal)] bg-[var(--seal)] px-4 text-sm font-semibold text-[var(--paper)] disabled:opacity-50"
          >
            存为草稿
          </button>
          {saveError ? (
            <p className="text-sm text-[var(--danger)]">{saveError}</p>
          ) : null}
        </div>

        <TechDetails summary="技术细节">
          <pre className="overflow-auto bg-[var(--paper-raised)] p-3 text-xs leading-6 text-[var(--ink-soft)]">
            {JSON.stringify({ options: previewOptions, answer }, null, 2)}
          </pre>
        </TechDetails>
      </section>

      <aside
        aria-labelledby="question-preview-heading"
        className="space-y-3 lg:sticky lg:top-6 lg:self-start"
        role="region"
      >
        <div>
          <p className="text-sm font-medium text-[var(--seal)]">卷面</p>
          <h2 id="question-preview-heading" className="mt-2 font-serif text-2xl font-semibold">
            预览
          </h2>
        </div>
        <QuestionPreview
          stemMd={stemMd}
          options={showOptions ? previewOptions : []}
          solutionMd={solutionMd}
          showSolution
        />
      </aside>
    </div>
  );
}
