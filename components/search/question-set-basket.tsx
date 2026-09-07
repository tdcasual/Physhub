"use client";

import { useMemo, useState } from "react";

export function QuestionSetBasket({
  questionIds,
  onRemove,
}: {
  questionIds: string[];
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("Untitled set");
  const [format, setFormat] = useState<"markdown" | "latex">("markdown");
  const [teacher, setTeacher] = useState(true);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueIds = useMemo(
    () => [...new Set(questionIds)],
    [questionIds],
  );

  async function handleExport() {
    setError(null);
    setOutput(null);

    try {
      const created = await fetch("/api/question-sets", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, questionIds: uniqueIds }),
      });
      const createdPayload = (await created.json()) as {
        error?: string;
        questionSet?: { id?: string };
      };

      if (!created.ok || !createdPayload.questionSet?.id) {
        setError(createdPayload.error ?? "Unable to create question set");
        return;
      }

      const exported = await fetch(
        `/api/question-sets/${createdPayload.questionSet.id}/export`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ format, teacher }),
        },
      );
      const exportPayload = (await exported.json()) as {
        error?: string;
        content?: string;
      };

      if (!exported.ok || !exportPayload.content) {
        setError(exportPayload.error ?? "Unable to export");
        return;
      }

      setOutput(exportPayload.content);
    } catch {
      setError("Unable to export");
    }
  }

  return (
    <section className="border border-stone-900/15 bg-stone-50 p-5">
      <h2 className="text-xl font-semibold">Question set basket</h2>
      <p className="mt-2 text-sm text-stone-900/60">
        In-memory only. Refreshing the page clears the basket.
      </p>
      {uniqueIds.length === 0 ? (
        <p className="mt-3 text-sm">No questions in the basket.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {uniqueIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-3">
              <span className="font-mono">{id}</span>
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-sm font-semibold"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className="mt-1 w-full border border-stone-900/20 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          Format
          <select
            value={format}
            onChange={(event) =>
              setFormat(event.currentTarget.value as "markdown" | "latex")
            }
            className="mt-1 w-full border border-stone-900/20 bg-white px-3 py-2"
          >
            <option value="markdown">Markdown</option>
            <option value="latex">LaTeX</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={teacher}
          onChange={(event) => setTeacher(event.currentTarget.checked)}
        />
        Teacher export (include answers)
      </label>
      <button
        type="button"
        disabled={uniqueIds.length === 0}
        onClick={() => void handleExport()}
        className="mt-4 border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Create and export
      </button>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      {output ? (
        <pre className="mt-4 max-h-80 overflow-auto bg-white p-3 text-xs">{output}</pre>
      ) : null}
    </section>
  );
}
