"use client";

import { useMemo, useState } from "react";
import type { DraftStatus, JobStatus, QuestionType, RawAssetKind, RawAssetStatus } from "@prisma/client";

import { AnswerEditor, type SingleAnswer } from "@/components/question/answer-editor";
import { OptionEditor, type EditableOption } from "@/components/question/option-editor";
import { QuestionPreview } from "@/components/question/question-preview";

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
  aiOutput: JsonValue | null;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
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

function parseSingleAnswer(value: JsonValue | null): SingleAnswer {
  if (isRecord(value) && value.type === "single" && typeof value.value === "string") {
    return {
      type: "single",
      value: value.value,
    };
  }

  return {
    type: "single",
    value: "",
  };
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
    return "No confidence";
  }

  return `${Math.round(value * 100)}% confidence`;
}

function jsonPreview(value: JsonValue | null) {
  if (value === null) {
    return "null";
  }

  return JSON.stringify(value, null, 2);
}

export function DraftReviewWorkspace({ draft }: { draft: DraftReviewWorkspaceDraft }) {
  const [stemMd, setStemMd] = useState(draft.stemMd ?? "");
  const [options, setOptions] = useState(() => parseOptions(draft.optionsJson));
  const [answer, setAnswer] = useState<SingleAnswer>(() =>
    parseSingleAnswer(draft.answerJson),
  );
  const [solutionMd, setSolutionMd] = useState(draft.solutionMd ?? "");
  const [status, setStatus] = useState(draft.status);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const previewOptions = useMemo(() => validOptions(options), [options]);
  const sourceText = draft.sourceRawAsset?.textContent?.trim();
  const canEdit = status === "DRAFT" || status === "NEEDS_REVIEW";

  async function patchDraft(
    action: string,
    body: Record<string, unknown>,
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
        draft?: { status?: DraftStatus };
      };

      if (!response.ok) {
        setActionError(payload.error ?? "Unable to update draft");
        return;
      }

      if (payload.draft?.status) {
        setStatus(payload.draft.status);
      }
    } catch {
      setActionError("Unable to update draft");
    } finally {
      setPendingAction(null);
    }
  }

  function handleSave() {
    return patchDraft("save", {
      type: draft.type ?? undefined,
      stemMd,
      options: previewOptions,
      answer,
      solutionMd,
    });
  }

  function handleReject() {
    return patchDraft("reject", { status: "REJECTED" });
  }

  function handleSendBack() {
    return patchDraft("send-back", { status: "DRAFT" });
  }

  function handleOptionsChange(nextOptions: EditableOption[]) {
    const nextAnswerValue = alignAnswerValue(options, nextOptions, answer.value);

    setOptions(nextOptions);
    if (nextAnswerValue !== answer.value) {
      setAnswer({ type: "single", value: nextAnswerValue });
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-[96rem] space-y-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-900/15 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
              Draft workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Draft Review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-900/65">
              Review parser output against the original asset, adjust the local draft
              view, and inspect the safe rendered preview before promotion.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 md:text-right">
            <div>
              <dt className="font-medium text-stone-900/55">Status</dt>
              <dd className="mt-1 font-semibold">{status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900/55">Type</dt>
              <dd className="mt-1 font-semibold">
                {draft.type?.replaceAll("_", " ") ?? "Unclassified"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900/55">Updated</dt>
              <dd className="mt-1 font-semibold">{formatDate(draft.updatedAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-stone-900/55">Draft ID</dt>
              <dd className="mt-1 font-mono text-xs">{draft.id}</dd>
            </div>
          </dl>
        </header>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={pendingAction !== null}
              className="border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                void handleReject();
              }}
              disabled={pendingAction !== null}
              className="border border-stone-900/30 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Reject
            </button>
            {status === "NEEDS_REVIEW" ? (
              <button
                type="button"
                onClick={() => {
                  void handleSendBack();
                }}
                disabled={pendingAction !== null}
                className="border border-stone-900/30 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Send back
              </button>
            ) : null}
            {actionError ? (
              <p className="text-sm text-red-800">{actionError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(24rem,1fr)_minmax(22rem,0.9fr)]">
          <section
            aria-labelledby="source-material-heading"
            className="space-y-4 border border-stone-900/15 bg-stone-50 p-4"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-800">
                Source
              </p>
              <h2 id="source-material-heading" className="mt-2 text-xl font-semibold">
                Raw Material
              </h2>
            </div>

            {draft.sourceRawAsset ? (
              <div className="space-y-4">
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-stone-900/55">Name</dt>
                    <dd className="mt-1 font-semibold">{draft.sourceRawAsset.originalName}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="font-medium text-stone-900/55">Kind</dt>
                      <dd className="mt-1">{draft.sourceRawAsset.kind}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-stone-900/55">Status</dt>
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
                    {sourceText || "No extracted text is available for this raw asset."}
                  </pre>
                )}

                {draft.sourceRawAsset.metadata ? (
                  <details className="border border-stone-900/15 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Asset metadata
                    </summary>
                    <pre className="mt-3 overflow-auto text-xs leading-5 text-stone-700">
                      {jsonPreview(draft.sourceRawAsset.metadata)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-stone-900/65">
                This draft is not linked to a raw asset.
              </p>
            )}
          </section>

          <section aria-labelledby="structured-draft-heading" className="space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
                Structured draft
              </p>
              <h2 id="structured-draft-heading" className="mt-2 text-xl font-semibold">
                Editable Parser Output
              </h2>
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

            <section className="border border-stone-900/15 bg-stone-50 p-4">
              <h3 className="text-base font-semibold">Draft JSON</h3>
              <pre className="mt-3 max-h-80 overflow-auto bg-white p-3 text-xs leading-6 text-stone-800">
                {JSON.stringify(
                  {
                    type: draft.type,
                    stemMd,
                    optionsJson: previewOptions,
                    answerJson: answer,
                    solutionMd,
                    originalAnswerJson: draft.answerJson,
                    aiOutput: draft.aiOutput,
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section
              aria-labelledby="question-preview-heading"
              className="space-y-3"
              role="region"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-800">
                  Renderer check
                </p>
                <h2 id="question-preview-heading" className="mt-2 text-xl font-semibold">
                  Live Preview
                </h2>
              </div>
              <QuestionPreview
                stemMd={stemMd || "No stem text yet."}
                options={previewOptions}
                solutionMd={solutionMd}
                showSolution
              />
            </section>

            <section className="space-y-3 border border-stone-900/15 bg-white p-4">
              <h2 className="text-xl font-semibold">Suggestions</h2>
              {draft.suggestions.length > 0 ? (
                <ul className="space-y-3">
                  {draft.suggestions.map((suggestion) => (
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
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-stone-900/65">
                  No suggestions are attached to this draft.
                </p>
              )}
            </section>

            <section className="space-y-3 border border-stone-900/15 bg-white p-4">
              <h2 className="text-xl font-semibold">Agent Runs</h2>
              {draft.agentRuns.length > 0 ? (
                <ul className="space-y-3">
                  {draft.agentRuns.map((run) => (
                    <li key={run.id} className="border border-stone-900/15 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{run.agentName}</p>
                          <p className="mt-1 text-xs text-stone-900/55">
                            {run.toolName ?? "No tool"} · {formatDate(run.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-lime-800">
                          {run.status}
                        </span>
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Input / output
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto bg-stone-50 p-2 text-xs leading-5 text-stone-700">
                          {JSON.stringify(
                            { input: run.input, output: run.output },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-stone-900/65">
                  No agent runs are linked to this draft.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
