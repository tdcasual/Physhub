"use client";

import { useCallback, useMemo, useState } from "react";
import type { DraftStatus, JobStatus, QuestionType, RawAssetKind, RawAssetStatus } from "@prisma/client";

import { AnswerEditor } from "@/components/question/answer-editor";
import { OptionEditor } from "@/components/question/option-editor";
import { QuestionPreview } from "@/components/question/question-preview";
import { RawAssetUpload } from "@/components/raw-asset/raw-asset-upload";
import { TaxonomyFields } from "@/components/taxonomy/taxonomy-fields";
import { Button } from "@/components/ui/button";
import {
  defaultAnswerForType,
  isChoiceType,
  optionsAfterTypeChange,
  parseEditableAnswer,
  parseIdArray,
  type EditableAnswer,
  type EditableOption,
} from "@/lib/domain/editor-answer";
import { suggestionPayloadMissingKnowledgePointId } from "@/lib/domain/suggestion-policy";
import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";
import {
  overlayStorageKey,
  useEditorOverlay,
  useLinkLeaveConfirm,
} from "@/lib/ui/editor-overlay";
import {
  buildDraftEditorPatch,
  type DraftEditorSnapshot,
} from "@/lib/ui/editor-patches";
import { labelDraftStatus, labelQuestionType, mapUiError } from "@/lib/ui/labels";
import { TechDetails } from "@/components/ui/tech-details";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type DraftReviewWorkspaceDraft = {
  id: string;
  status: DraftStatus;
  type: QuestionType | null;
  stemMd: string | null;
  optionsJson: JsonValue | null;
  answerJson: JsonValue | null;
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: JsonValue | null;
  tagIds: JsonValue | null;
  aiOutput: JsonValue | null;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  promotedQuestionId: string | null;
  sourceRawAsset: {
    id: string;
    kind: RawAssetKind;
    status: RawAssetStatus;
    originalName: string;
    mimeType: string | null;
    textContent: string | null;
    metadata: JsonValue | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  suggestions: {
    id: string;
    kind: string;
    payload: JsonValue;
    confidence: number | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    knowledgePoint: {
      name: string;
      slug: string;
    } | null;
    createdByAgentRun: {
      agentName: string;
      toolName: string | null;
    } | null;
  }[];
  agentRuns: {
    id: string;
    agentName: string;
    toolName: string | null;
    model: string | null;
    status: JobStatus;
    confidence: number | null;
    accepted: boolean | null;
    input: JsonValue;
    output: JsonValue | null;
    createdAt: string;
  }[];
};

function isRecord(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseOptions(value: JsonValue | null): EditableOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      if (!isRecord(option)) {
        return null;
      }

      const label = option.label;
      const optionValue = option.value;

      if (typeof label !== "string" || typeof optionValue !== "string") {
        return null;
      }

      return { label, value: optionValue };
    })
    .filter((option): option is EditableOption => option !== null);
}

function knowledgePointIdsFromPayload(payload: JsonValue): string[] {
  if (!isRecord(payload)) {
    return [];
  }

  const points = payload.knowledge_points;

  if (!Array.isArray(points)) {
    return [];
  }

  return points.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim()) {
      return [];
    }

    return [item.id.trim()];
  });
}

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConfidence(value: number | null) {
  if (value === null) {
    return "未给置信度";
  }

  return `置信度 ${Math.round(value * 100)}%`;
}

function jsonPreview(value: JsonValue | null) {
  if (value === null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export function DraftReviewWorkspace({
  draft,
  knowledgePoints,
  tags,
}: {
  draft: DraftReviewWorkspaceDraft;
  knowledgePoints: KnowledgePointDto[];
  tags: TagDto[];
}) {
  const [stemMd, setStemMd] = useState(draft.stemMd ?? "");
  const [options, setOptions] = useState(() => parseOptions(draft.optionsJson));
  const [type, setType] = useState<QuestionType | "">(draft.type ?? "");
  const [answer, setAnswer] = useState<EditableAnswer>(() =>
    parseEditableAnswer(draft.answerJson, draft.type),
  );
  const [solutionMd, setSolutionMd] = useState(draft.solutionMd ?? "");
  const [knowledgePointIds, setKnowledgePointIds] = useState(() =>
    parseIdArray(draft.knowledgePointIds),
  );
  const [tagIds, setTagIds] = useState(() => parseIdArray(draft.tagIds));
  const [difficulty, setDifficulty] = useState<number | null>(
    draft.difficulty,
  );
  const [status, setStatus] = useState(draft.status);
  const [promotedAt, setPromotedAt] = useState(draft.promotedAt);
  const [promotedQuestionId, setPromotedQuestionId] = useState(
    draft.promotedQuestionId,
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(draft.suggestions);

  const previewOptions = useMemo(() => validOptions(options), [options]);
  const sourceText = draft.sourceRawAsset?.textContent?.trim();
  const canEdit = status === "DRAFT" || status === "NEEDS_REVIEW";
  const showOptions = isChoiceType(type) || type === "";
  const canPromote = canEdit && knowledgePointIds.length > 0;
  const snapshot: DraftEditorSnapshot = useMemo(
    () => ({
      type,
      stemMd,
      options,
      answer,
      solutionMd,
      knowledgePointIds,
      tagIds,
      difficulty,
    }),
    [answer, difficulty, knowledgePointIds, options, solutionMd, stemMd, tagIds, type],
  );
  const hydrate = useCallback((next: DraftEditorSnapshot) => {
    setStemMd(next.stemMd);
    setOptions(next.options);
    setAnswer(next.answer);
    setSolutionMd(next.solutionMd);
    setKnowledgePointIds(next.knowledgePointIds);
    setTagIds(next.tagIds);
    setDifficulty(next.difficulty);
    setType(next.type);
  }, []);
  const overlay = useEditorOverlay<DraftEditorSnapshot>({
    storageKey: overlayStorageKey("draft", draft.id),
    snapshot,
    serverBaseVersion: draft.updatedAt,
    onHydrate: hydrate,
  });
  useLinkLeaveConfirm(overlay.isDirty);

  function buildEditorFields() {
    return buildDraftEditorPatch(snapshot, showOptions);
  }

  async function patchDraft(
    action: string,
    body: Record<string, unknown>,
    submitted: DraftEditorSnapshot,
  ) {
    setPendingAction(action);
    setActionError(null);

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        draft?: { status?: DraftStatus; updatedAt?: string };
      };

      if (!response.ok) {
        setActionError(mapUiError(payload.error ?? "无法保存草稿"));
        return { ok: false, leftover: true };
      }

      if (payload.draft?.status) {
        setStatus(payload.draft.status);
      }

      const leftover = overlay.markClean(
        payload.draft?.updatedAt ?? new Date().toISOString(),
        submitted,
      );
      return { ok: true, leftover };
    } catch {
      setActionError("无法保存草稿");
      return { ok: false, leftover: true };
    } finally {
      setPendingAction(null);
    }
  }

  function handleSave() {
    return patchDraft("save", buildEditorFields(), snapshot);
  }

  function handleReject() {
    return patchDraft(
      "reject",
      { ...buildEditorFields(), status: "REJECTED" },
      snapshot,
    );
  }

  async function persistEditorFields(): Promise<{
    ok: boolean;
    leftover: boolean;
  }> {
    const submitted = snapshot;

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildDraftEditorPatch(submitted, showOptions)),
      });
      const payload = (await response.json()) as {
        error?: string;
        draft?: { status?: DraftStatus; updatedAt?: string };
      };

      if (!response.ok) {
        setActionError(mapUiError(payload.error ?? "无法保存草稿"));
        return { ok: false, leftover: true };
      }

      if (payload.draft?.status) {
        setStatus(payload.draft.status);
      }

      const leftover = overlay.markClean(
        payload.draft?.updatedAt ?? new Date().toISOString(),
        submitted,
      );
      return { ok: true, leftover };
    } catch {
      setActionError("无法保存草稿");
      return { ok: false, leftover: true };
    }
  }

  async function handlePromote() {
    setPendingAction("promote");
    setActionError(null);

    try {
      const saved = await persistEditorFields();

      if (!saved.ok || saved.leftover) {
        if (saved.ok && saved.leftover) {
          setActionError("还有未保存的修改，未入库");
        }
        return;
      }

      const response = await fetch(`/api/drafts/${draft.id}/promote`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json()) as {
        error?: string;
        draft?: {
          status?: DraftStatus;
          promotedAt?: string | null;
          promotedQuestionId?: string | null;
        };
        question?: { id?: string };
      };

      if (!response.ok) {
        setActionError(mapUiError(payload.error ?? "无法入库"));
        return;
      }

      if (payload.draft?.status) {
        setStatus(payload.draft.status);
      }

      setPromotedAt(payload.draft?.promotedAt ?? promotedAt);
      setPromotedQuestionId(
        payload.question?.id ??
          payload.draft?.promotedQuestionId ??
          promotedQuestionId,
      );
    } catch {
      setActionError("无法入库");
    } finally {
      setPendingAction(null);
    }
  }

  async function reviewSuggestion(
    suggestionId: string,
    nextStatus: "accepted" | "rejected",
  ) {
    setPendingAction(`suggestion:${suggestionId}:${nextStatus}`);
    setActionError(null);

    try {
      const response = await fetch(`/api/suggestions/${suggestionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as {
        error?: string;
        suggestion?: { status?: string };
        draft?: {
          updatedAt?: string;
          knowledgePointIds?: unknown;
          difficulty?: number | null;
          tagIds?: unknown;
        };
      };

      if (!response.ok) {
        setActionError(mapUiError(payload.error ?? "无法处理建议"));
        return;
      }

      setSuggestions((current) =>
        current.map((item) =>
          item.id === suggestionId
            ? { ...item, status: payload.suggestion?.status ?? nextStatus }
            : item,
        ),
      );

      if (nextStatus === "accepted") {
        if (payload.draft) {
          if (Array.isArray(payload.draft.knowledgePointIds)) {
            setKnowledgePointIds(
              payload.draft.knowledgePointIds.filter(
                (id): id is string => typeof id === "string" && id.length > 0,
              ),
            );
          }

          if ("difficulty" in payload.draft) {
            setDifficulty(payload.draft.difficulty ?? null);
          }

          if (Array.isArray(payload.draft.tagIds)) {
            setTagIds(
              payload.draft.tagIds.filter(
                (id): id is string => typeof id === "string" && id.length > 0,
              ),
            );
          }

          if (payload.draft.updatedAt) {
            overlay.advanceBase(payload.draft.updatedAt);
          }
        } else {
          const accepted = suggestions.find((item) => item.id === suggestionId);
          const acceptedIds = accepted
            ? knowledgePointIdsFromPayload(accepted.payload)
            : [];

          if (acceptedIds.length > 0) {
            setKnowledgePointIds((current) => [
              ...new Set([...current, ...acceptedIds]),
            ]);
          }
        }
      }
    } catch {
      setActionError("无法处理建议");
    } finally {
      setPendingAction(null);
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

  return (
    <main id="main" className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-[96rem] space-y-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-900/15 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--patina)]">审稿</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">审题</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-soft)]">
              对照来源改题干和知识点，确认卷面无误后再入库。
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 md:text-right">
            <div>
              <dt className="font-medium text-[var(--ink-faint)]">状态</dt>
              <dd className="mt-1 font-semibold">{labelDraftStatus(status)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ink-faint)]">题型</dt>
              <dd className="mt-1 font-semibold">
                {type ? labelQuestionType(type) : "未分类"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ink-faint)]">更新</dt>
              <dd className="mt-1 font-semibold">{formatDate(draft.updatedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--ink-faint)]">草稿编号</dt>
              <dd className="mt-1 font-mono text-xs">{draft.id}</dd>
            </div>
          </dl>
        </header>

        {overlay.restored ? (
          <p role="status" className="text-sm text-[var(--patina)]">
            已恢复未提交的修改
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                void handleSave();
              }}
              disabled={pendingAction !== null}
            >
              保存
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void handleReject();
              }}
              disabled={pendingAction !== null}
            >
              退回
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                void handlePromote();
              }}
              disabled={pendingAction !== null || !canPromote}
            >
              入库
            </Button>
            {!canPromote ? (
              <p className="text-sm text-[var(--ink-soft)]">
                入库前请先勾选至少一个知识点。
              </p>
            ) : null}
            {actionError ? (
              <p className="text-sm text-red-800">{actionError}</p>
            ) : null}
          </div>
        ) : null}

        {status === "PROMOTED" || promotedAt || promotedQuestionId ? (
          <p className="text-sm text-stone-900/80">
            已入库
            {promotedAt ? ` ${formatDate(promotedAt)}` : ""}
            {promotedQuestionId ? ` · 题库 ${promotedQuestionId}` : ""}
          </p>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(24rem,1fr)_minmax(22rem,0.9fr)]">
          <section
            aria-labelledby="source-material-heading"
            className="space-y-4 border border-stone-900/15 bg-stone-50 p-4"
          >
            <div>
              <p className="text-sm font-medium text-[var(--patina)]">来源</p>
              <h2 id="source-material-heading" className="mt-2 font-serif text-xl font-semibold">
                原始材料
              </h2>
            </div>

            {draft.sourceRawAsset ? (
              <div className="space-y-4">
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-[var(--ink-faint)]">文件名</dt>
                    <dd className="mt-1 font-semibold">{draft.sourceRawAsset.originalName}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="font-medium text-[var(--ink-faint)]">类型</dt>
                      <dd className="mt-1">{draft.sourceRawAsset.kind}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-[var(--ink-faint)]">状态</dt>
                      <dd className="mt-1">{draft.sourceRawAsset.status}</dd>
                    </div>
                  </div>
                  {draft.sourceRawAsset.mimeType ? (
                    <div>
                      <dt className="font-medium text-stone-900/55">MIME</dt>
                      <dd className="mt-1 font-mono text-xs">{draft.sourceRawAsset.mimeType}</dd>
                    </div>
                  ) : null}
                </dl>

                {draft.sourceRawAsset.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/raw-assets/${draft.sourceRawAsset.id}/file`}
                    alt={draft.sourceRawAsset.originalName}
                    className="max-h-[34rem] w-full border border-stone-900/15 bg-white object-contain"
                  />
                ) : (
                  <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap border border-stone-900/15 bg-white p-3 text-sm leading-6 text-stone-900">
                    {sourceText || "这份来源没有可显示的文本。"}
                  </pre>
                )}

                {draft.sourceRawAsset.metadata ? (
                  <TechDetails summary="来源元数据">
                    <pre className="overflow-auto text-xs leading-5 text-[var(--ink-soft)]">
                      {jsonPreview(draft.sourceRawAsset.metadata)}
                    </pre>
                  </TechDetails>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-stone-900/65">
                这份草稿还没有关联来源文件。
              </p>
            )}
            {canEdit ? (
              <RawAssetUpload
                onUploaded={(rawAssetId) => {
                  void patchDraft(
                    "attach-source",
                    {
                      ...buildEditorFields(),
                      sourceRawAssetId: rawAssetId,
                    },
                    snapshot,
                  );
                }}
              />
            ) : null}
          </section>

          <section aria-labelledby="structured-draft-heading" className="space-y-5">
            <div>
              <p className="text-sm font-medium text-[var(--patina)]">
                结构化草稿
              </p>
              <h2 id="structured-draft-heading" className="mt-2 font-serif text-xl font-semibold">
                可编辑内容
              </h2>
            </div>

            <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
              题干
              <textarea
                value={stemMd}
                onChange={(event) => setStemMd(event.currentTarget.value)}
                rows={8}
                disabled={!canEdit}
                className="w-full resize-y border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm text-stone-950 shadow-sm disabled:bg-stone-100"
              />
            </label>

            <TaxonomyFields
              knowledgePoints={knowledgePoints}
              tags={tags}
              value={{ knowledgePointIds, tagIds, difficulty, type }}
              disabled={!canEdit}
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
              <OptionEditor
                options={options}
                onChange={handleOptionsChange}
                disabled={!canEdit}
              />
            ) : null}
            <AnswerEditor
              answer={answer}
              options={previewOptions}
              onChange={setAnswer}
              disabled={!canEdit}
            />

            <label className="block space-y-2 text-sm font-medium text-[var(--ink-soft)]">
              解析
              <textarea
                value={solutionMd}
                onChange={(event) => setSolutionMd(event.currentTarget.value)}
                rows={6}
                disabled={!canEdit}
                className="w-full resize-y border border-stone-900/20 bg-white px-4 py-3 font-mono text-sm text-stone-950 shadow-sm disabled:bg-stone-100"
              />
            </label>

            <TechDetails summary="技术细节">
              <pre className="max-h-80 overflow-auto bg-[var(--paper-raised)] p-3 text-xs leading-6 text-[var(--ink-soft)]">
                {JSON.stringify(
                  {
                    type,
                    stemMd,
                    optionsJson: previewOptions,
                    answerJson: answer,
                    solutionMd,
                    knowledgePointIds,
                    tagIds,
                    difficulty,
                    originalAnswerJson: draft.answerJson,
                    aiOutput: draft.aiOutput,
                  },
                  null,
                  2,
                )}
              </pre>
            </TechDetails>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section
              aria-labelledby="question-preview-heading"
              className="space-y-3"
              role="region"
            >
              <div>
                <p className="text-sm font-medium text-[var(--seal)]">卷面</p>
                <h2 id="question-preview-heading" className="mt-2 font-serif text-xl font-semibold">
                  预览
                </h2>
              </div>
              <QuestionPreview
                stemMd={stemMd || "还没有题干。"}
                options={previewOptions}
                solutionMd={solutionMd}
                showSolution
              />
            </section>

            <section className="space-y-3 border border-stone-900/15 bg-white p-4">
              <h2 className="font-serif text-xl font-semibold">建议</h2>
              {suggestions.length > 0 ? (
                <ul className="space-y-3">
                  {suggestions.map((suggestion) => {
                    const acceptDisabled =
                      suggestionPayloadMissingKnowledgePointId(
                        suggestion.payload,
                      );
                    const reviewBusy = pendingAction !== null;

                    return (
                      <li
                        key={suggestion.id}
                        className="border border-stone-900/15 bg-stone-50 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">
                              {suggestion.knowledgePoint?.name ?? suggestion.kind}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-stone-900/55">
                              {suggestion.status.replaceAll("_", " ")}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-orange-800">
                            {formatConfidence(suggestion.confidence)}
                          </span>
                        </div>
                        {suggestion.createdByAgentRun ? (
                          <p className="mt-3 text-xs text-stone-900/60">
                            {suggestion.createdByAgentRun.agentName}
                            {suggestion.createdByAgentRun.toolName
                              ? ` · ${suggestion.createdByAgentRun.toolName}`
                              : ""}
                          </p>
                        ) : null}
                        <pre className="mt-3 max-h-36 overflow-auto bg-white p-2 text-xs leading-5 text-stone-700">
                          {jsonPreview(suggestion.payload)}
                        </pre>
                        {suggestion.status === "pending_review" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              aria-label="接受建议"
                              onClick={() => {
                                void reviewSuggestion(suggestion.id, "accepted");
                              }}
                              disabled={reviewBusy || acceptDisabled}
                              className="border border-stone-900 bg-stone-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              接受
                            </button>
                            <button
                              type="button"
                              aria-label="不用该建议"
                              onClick={() => {
                                void reviewSuggestion(suggestion.id, "rejected");
                              }}
                              disabled={reviewBusy}
                              className="border border-stone-900/30 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                            >
                              不用
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-stone-900/65">
                  这条草稿还没有建议。
                </p>
              )}
            </section>

            <TechDetails summary="运行记录">
              {draft.agentRuns.length > 0 ? (
                <ul className="space-y-3">
                  {draft.agentRuns.map((run) => (
                    <li key={run.id} className="border border-stone-900/15 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{run.agentName}</p>
                          <p className="mt-1 text-xs text-stone-900/55">
                            {run.toolName ?? "无工具"} · {formatDate(run.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-lime-800">
                          {run.status}
                        </span>
                      </div>
                      <pre className="mt-2 max-h-44 overflow-auto bg-[var(--paper-mute)] p-2 text-xs leading-5 text-[var(--ink-soft)]">
                        {JSON.stringify(
                          { input: run.input, output: run.output },
                          null,
                          2,
                        )}
                      </pre>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-[var(--ink-faint)]">
                  没有关联的运行记录。
                </p>
              )}
            </TechDetails>
          </aside>
        </div>
      </div>
    </main>
  );
}
