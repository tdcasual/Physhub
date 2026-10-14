"use client";

import { useCallback, useMemo, useState } from "react";
import type { QuestionType } from "@prisma/client";

import { AnswerEditor } from "@/components/question/answer-editor";
import { OptionEditor } from "@/components/question/option-editor";
import { QuestionPreview } from "@/components/question/question-preview";
import { TaxonomyFields } from "@/components/taxonomy/taxonomy-fields";
import { Button } from "@/components/ui/button";
import {
  defaultAnswerForType,
  isChoiceType,
  optionsAfterTypeChange,
  parseEditableAnswer,
  type EditableAnswer,
  type EditableOption,
} from "@/lib/domain/editor-answer";
import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";
import {
  overlayStorageKey,
  useEditorOverlay,
  useLinkLeaveConfirm,
} from "@/lib/ui/editor-overlay";
import {
  buildOfficialEditorPatch,
  officialSnapshotIncomplete,
  type OfficialEditorSnapshot,
} from "@/lib/ui/editor-patches";
import { labelQuestionStatus, mapUiError } from "@/lib/ui/labels";

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
  version: number;
};

function validOptions(options: EditableOption[]) {
  return options.filter(
    (option) => option.label.trim() && option.value.trim(),
  );
}

export { buildOfficialEditorPatch };

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
  const snapshot: OfficialEditorSnapshot = useMemo(
    () => ({
      type: (type || question.type) as QuestionType,
      stemMd,
      options,
      answer,
      solutionMd,
      knowledgePointIds,
      tagIds,
      difficulty,
    }),
    [
      answer,
      difficulty,
      knowledgePointIds,
      options,
      question.type,
      solutionMd,
      stemMd,
      tagIds,
      type,
    ],
  );
  const hydrate = useCallback((next: OfficialEditorSnapshot) => {
    setStemMd(next.stemMd);
    setOptions(next.options);
    setType(next.type);
    setAnswer(next.answer);
    setSolutionMd(next.solutionMd);
    setKnowledgePointIds(next.knowledgePointIds);
    setTagIds(next.tagIds);
    setDifficulty(next.difficulty);
  }, []);
  const overlay = useEditorOverlay<OfficialEditorSnapshot>({
    storageKey: overlayStorageKey("question", question.id),
    snapshot,
    serverBaseVersion: question.version,
    onHydrate: hydrate,
  });
  useLinkLeaveConfirm(overlay.isDirty);

  async function persistSnapshot(): Promise<{ ok: boolean; leftover: boolean }> {
    const submitted = snapshot;

    if (officialSnapshotIncomplete(submitted, showOptions)) {
      setMessage("请先补全选项和答案");
      return { ok: false, leftover: true };
    }

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildOfficialEditorPatch(submitted, showOptions)),
      });
      const payload = (await response.json()) as {
        error?: string;
        version?: number;
        question?: { status?: string };
      };

      if (!response.ok) {
        setMessage(mapUiError(payload.error ?? "无法保存试题"));
        return { ok: false, leftover: true };
      }

      if (payload.question?.status) {
        setStatus(payload.question.status);
      }

      const leftover = overlay.markClean(
        payload.version ?? question.version,
        submitted,
      );
      setMessage(
        leftover
          ? "已保存，还有未提交的后续修改"
          : payload.version
            ? `已保存第 ${payload.version} 版`
            : "已保存",
      );
      return { ok: true, leftover };
    } catch {
      setMessage("无法保存试题");
      return { ok: false, leftover: true };
    } finally {
      setPending(false);
    }
  }

  async function patchStatus(nextStatus: "PUBLISHED" | "DEPRECATED") {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/questions/${question.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as {
        error?: string;
        version?: number;
        question?: { status?: string };
      };

      if (!response.ok) {
        setMessage(mapUiError(payload.error ?? "无法更新试题"));
        return;
      }

      if (payload.question?.status) {
        setStatus(payload.question.status);
      }

      if (payload.version !== undefined) {
        overlay.advanceBase(payload.version);
      }

      setMessage(nextStatus === "PUBLISHED" ? "已上架" : "已停用");
    } catch {
      setMessage("无法更新试题");
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    if (overlay.isDirty) {
      const result = await persistSnapshot();

      if (!result.ok || result.leftover) {
        if (result.ok && result.leftover) {
          setMessage("还有未保存的修改，未上架");
        }
        return;
      }
    }

    await patchStatus("PUBLISHED");
  }

  async function handleDeprecate() {
    if (!window.confirm("确定停用这道题？")) {
      return;
    }

    if (overlay.isDirty) {
      const result = await persistSnapshot();

      if (!result.ok || result.leftover) {
        if (result.ok && result.leftover) {
          setMessage("还有未保存的修改，未停用");
        }
        return;
      }
    }

    await patchStatus("DEPRECATED");
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
        {overlay.restored ? (
          <p role="status" className="text-sm text-[var(--patina)]">
            已恢复未提交的修改
          </p>
        ) : null}
        <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
          题干
          <textarea
            value={stemMd}
            onChange={(event) => setStemMd(event.currentTarget.value)}
            rows={8}
            className="w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-4 py-3 font-mono text-sm"
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
            className="w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-4 py-3 font-mono text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={pending}
            onClick={() => {
              void persistSnapshot();
            }}
          >
            保存修订
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || status !== "REVIEWED"}
            onClick={() => {
              void handlePublish();
            }}
          >
            上架
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || status === "DEPRECATED"}
            onClick={() => {
              void handleDeprecate();
            }}
          >
            停用
          </Button>
        </div>
        {message ? <p className="text-sm text-[var(--ink-soft)]">{message}</p> : null}
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
