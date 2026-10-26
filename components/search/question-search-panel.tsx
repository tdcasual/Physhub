"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";

import Link from "next/link";

import { MarkdownLatex } from "@/lib/renderer/render-markdown";
import type { QuestionSearchResponse } from "@/lib/search/question-search";
import type { BasketItem } from "@/components/search/question-set-basket";
import { labelQuestionStatus, mapUiError } from "@/lib/ui/labels";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: QuestionSearchResponse }
  | { status: "error"; message: string };

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };

    return typeof body.error === "string"
      ? mapUiError(body.error)
      : "无法检索试题";
  } catch {
    return "无法检索试题";
  }
}

export function QuestionSearchPanel({
  onAddToBasket,
}: {
  onAddToBasket?: (item: BasketItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchState({ status: "error", message: "请先输入要找的内容。" });
      return;
    }

    setSearchState({ status: "loading" });

    try {
      const response = await fetch("/api/search/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          constraints: {
            status: ["PUBLISHED", "REVIEWED"],
            limit: 10,
          },
        }),
      });

      if (!response.ok) {
        setSearchState({ status: "error", message: await readError(response) });
        return;
      }

      setSearchState({
        status: "success",
        response: (await response.json()) as QuestionSearchResponse,
      });
    } catch {
      setSearchState({ status: "error", message: "无法检索试题" });
    }
  }

  return (
    <section className="border border-[var(--ink-border)] bg-[var(--paper-mute)] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--patina)]">检索</p>
          <h2 className="mt-2 font-serif text-2xl font-semibold">找题</h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl"
        >
          <label className="sr-only" htmlFor="question-search-query">
            用中文描述要找的题
          </label>
          <input
            id="question-search-query"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="找 10 道高一运动学基础题，适合随堂练习"
            className="min-h-11 flex-1 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 text-sm text-[var(--ink)] focus:border-[var(--seal)]"
          />
          <button
            type="submit"
            disabled={searchState.status === "loading"}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--ink-border)] bg-[var(--ink)] px-4 text-sm font-semibold text-white hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:bg-[var(--paper-mute)]0"
          >
            {searchState.status === "loading" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Search aria-hidden="true" className="size-4" />
            )}
            搜索
          </button>
        </form>
      </div>

      {searchState.status === "error" ? (
        <p
          role="alert"
          className="mt-4 border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]"
        >
          {searchState.message}
        </p>
      ) : null}

      {searchState.status === "success" ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm text-[var(--ink-soft)]">
            <span>找到 {searchState.response.results.length} 道题</span>
            <span>最多 {searchState.response.understanding.limit} 道</span>
            {searchState.response.understanding.terms.map((term) => (
              <span
                key={term}
                className="border border-[var(--ink-border)] bg-[var(--paper-raised)] px-2 py-1"
              >
                {term}
              </span>
            ))}
          </div>

          {searchState.response.results.length === 0 ? (
            <p className="border border-[var(--ink-border)] bg-[var(--paper-raised)] p-4 text-sm text-[var(--ink-soft)]">
              没有匹配的已审定或已上架试题。
            </p>
          ) : (
            <div className="grid gap-3">
              {searchState.response.results.map((result) => (
                <article
                  key={result.id}
                  className="border border-[var(--ink-border)] bg-[var(--paper-raised)] p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-lg font-semibold">
                      <Link href={`/questions/${result.id}`} className="hover:underline">
                        {result.question_id}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                      <span className="border border-[var(--ink-border)] px-2 py-1">
                        相关 {result.score}
                      </span>
                      <span className="border border-[var(--patina)] bg-[var(--patina-soft)] px-2 py-1 text-[var(--patina)]">
                        {labelQuestionStatus(result.status)}
                      </span>
                      {onAddToBasket ? (
                        <button
                          type="button"
                          onClick={() =>
                            onAddToBasket({
                              id: result.id,
                              publicId: result.question_id,
                              stemMd: result.stemMd,
                            })
                          }
                          className="inline-flex min-h-11 items-center border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 text-xs font-semibold"
                        >
                          加入组卷篮
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="prose mt-3 max-w-none text-sm">
                    <MarkdownLatex content={result.stemMd} />
                  </div>
                  <p className="mt-3 text-sm text-[var(--ink-soft)]">{result.reason}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
