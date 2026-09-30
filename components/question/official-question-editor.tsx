"use client";

import { useState } from "react";
import type { QuestionType } from "@prisma/client";

import { AnswerEditor } from "@/components/question/answer-editor";
import { OptionEditor } from "@/components/question/option-editor";
import { QuestionPreview } from "@/components/question/question-preview";
import { TaxonomyFields } from "@/components/taxonomy/taxonomy-fields";
import {
  defaultAnswerForType,
  isChoiceType,
  optionsAfterTypeChange,
  parseEditableAnswer,
  type EditableAnswer,
  type EditableOption,
} from "@/lib/domain/editor-answer";
import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";
import { labelQuestionStatus } from "@/lib/ui/labels";

export type OfficialQuestionEditorQuestion = {
  id: string;
  publicId: string;
  status: string;
  type: QuestionType;
  stemMd: string;
  optionsJson: Array<{ label: string; value: string }> | null;
  answerJson: { type: string; value: string | string[] };
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: string[];
  tagIds: string[];
};

function validOptions(options: EditableOption[]) {
  return options.filter(
    (option) => option.label.trim() && option.value.trim(),
  );
}

export function OfficialQuestionEditor({
  question,
  knowledgePoints,
  tags,
}: {
  question: OfficialQuestionEditorQuestion;
  knowledgePoints: KnowledgePointDto[];
  tags: TagDto[];
}) {
  const [stemMd, setStemMd] = useState(question.stemMd);
  const [options, setOptions] = useState<EditableOption[]>(
    question.optionsJson ?? [],
  );
  const [type, setType] = useState<QuestionType | "">(question.type);
  const [answer, setAnswer] = useState<EditableAnswer>(() =>
    parseEditableAnswer(question.answerJson, question.type),
  );
  const [solutionMd, setSolutionMd] = useState(question.solutionMd ?? "");
  const [knowledgePointIds, setKnowledgePointIds] = useState(
    question.knowledgePointIds,
  );
  const [tagIds, setTagIds] = useState(question.tagIds);
  const [difficulty, setDifficulty] = useState<number | null>(
    question.difficulty,
  );
  const [status, setStatus] = useState(question.status);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const showOptions = isChoiceType(type) || type === "";
  const previewOptions = validOptions(options);

  async function patch(body: unknown) {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        version?: number;
        question?: { status?: string };
      };

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to update question");
        return;
      }

      if (payload.question?.status) {
        setStatus(payload.question.status);
      }

      setMessage(
        payload.version
          ? `Saved version ${payload.version}`
          : "Saved",
      );
    } catch {
      setMessage("Unable to update question");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)] lg:px-10">
      <section className="space-y-5">
        <div>
          <p className="text-sm font-medium text-[var(--patina)]">题库</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">{question.publicId}</h1>
          <p className="mt-2 text-sm text-[var(--ink-faint)]">
            {labelQuestionStatus(status)}
          </p>
        </div>
        <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
          题干
          <textarea
            value={stemMd}
            onChange={(event) => setStemMd(event.currentTarget.value)}
            rows={8}
            className="w-full border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm"
          />
        </label>
        <TaxonomyFields
          knowledgePoints={knowledgePoints}
          tags={tags}
          value={{ knowledgePointIds, tagIds, difficulty, type }}
          onChange={(next) => {
            setKnowledgePointIds(next.knowledgePointIds);
            setTagIds(next.tagIds);
            setDifficulty(next.difficulty);
            setType(next.type);
            const nextOptions = optionsAfterTypeChange(next.type, options);
            setOptions(nextOptions);
            setAnswer(
              defaultAnswerForType(next.type, validOptions(nextOptions), answer),
            );
          }}
        />
        {showOptions ? (
          <OptionEditor options={options} onChange={setOptions} />
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
            rows={5}
            className="w-full border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void patch({
                type: type || question.type,
                stemMd,
                ...(showOptions ? { options: previewOptions } : {}),
                answer,
                solutionMd,
                knowledgePointIds,
                tagIds,
                ...(typeof difficulty === "number" ? { difficulty } : {}),
              })
            }
            className="border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            保存修订
          </button>
          <button
            type="button"
            disabled={pending || status !== "REVIEWED"}
            onClick={() => void patch({ status: "PUBLISHED" })}
            className="inline-flex min-h-11 items-center border border-[var(--seal)] bg-[var(--seal)] px-4 text-sm font-semibold text-[var(--paper)] disabled:opacity-50"
          >
            上架
          </button>
          <button
            type="button"
            disabled={pending || status === "DEPRECATED"}
            onClick={() => void patch({ status: "DEPRECATED" })}
            className="inline-flex min-h-11 items-center border border-[var(--ink-border)] bg-[var(--paper-raised)] px-4 text-sm font-semibold disabled:opacity-50"
          >
            停用
          </button>
        </div>
        {message ? <p className="text-sm text-stone-900/80">{message}</p> : null}
      </section>
      <aside role="region" aria-label="预览">
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
