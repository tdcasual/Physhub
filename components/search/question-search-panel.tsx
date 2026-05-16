"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";

import { MarkdownLatex } from "@/lib/renderer/render-markdown";
import type { QuestionSearchResponse } from "@/lib/search/question-search";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: QuestionSearchResponse }
  | { status: "error"; message: string };

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };

    return typeof body.error === "string"
      ? body.error
      : "Unable to search questions";
  } catch {
    return "Unable to search questions";
  }
}

export function QuestionSearchPanel() {
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchState({ status: "error", message: "Enter a search query first." });
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
      setSearchState({ status: "error", message: "Unable to search questions" });
    }
  }

  return (
    <section className="border border-stone-900/15 bg-sky-100/70 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lime-800">
            Natural-language search
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Find reviewed questions</h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl"
        >
          <label className="sr-only" htmlFor="question-search-query">
            Natural-language question search
          </label>
          <input
            id="question-search-query"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="找 10 道高一运动学基础题，适合随堂练习"
            className="min-h-11 flex-1 border border-stone-900/20 bg-white px-3 text-sm text-stone-950 outline-none focus:border-orange-800"
          />
          <button
            type="submit"
            disabled={searchState.status === "loading"}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-stone-900/20 bg-stone-950 px-4 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500"
          >
            {searchState.status === "loading" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Search aria-hidden="true" className="size-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {searchState.status === "error" ? (
        <p
          role="alert"
          className="mt-4 border border-red-900/20 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
        >
          {searchState.message}
        </p>
      ) : null}

      {searchState.status === "success" ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm text-stone-900/70">
            <span>{searchState.response.results.length} results</span>
            <span>Limit {searchState.response.understanding.limit}</span>
            {searchState.response.understanding.terms.map((term) => (
              <span
                key={term}
                className="border border-stone-900/15 bg-white px-2 py-1"
              >
                {term}
              </span>
            ))}
          </div>

          {searchState.response.results.length === 0 ? (
            <p className="border border-stone-900/15 bg-white p-4 text-sm text-stone-900/70">
              No matching reviewed or published questions found.
            </p>
          ) : (
            <div className="grid gap-3">
              {searchState.response.results.map((result) => (
                <article
                  key={result.id}
                  className="border border-stone-900/15 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h3 className="text-lg font-semibold">
                      {result.question_id}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
                      <span className="border border-stone-900/15 px-2 py-1">
                        Score {result.score}
                      </span>
                      <span className="border border-lime-800/25 bg-lime-50 px-2 py-1 text-lime-800">
                        {result.status}
                      </span>
                    </div>
                  </div>
                  <div className="prose prose-stone mt-3 max-w-none text-sm">
                    <MarkdownLatex content={result.stemMd} />
                  </div>
                  <p className="mt-3 text-sm text-stone-900/60">{result.reason}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
