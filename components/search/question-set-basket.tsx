"use client";

import { useMemo, useState } from "react";

export type BasketItem = {
  id: string;
  publicId: string;
  stemMd: string;
};

function stemPreview(stemMd: string) {
  const stem = stemMd.replace(/\s+/g, " ").trim();

  if (stem.length <= 80) {
    return stem;
  }

  return `${stem.slice(0, 80).trimEnd()}…`;
}

export function QuestionSetBasket({
  items,
  onRemove,
}: {
  items: BasketItem[];
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("Untitled set");
  const [format, setFormat] = useState<"markdown" | "latex">("markdown");
  const [teacher, setTeacher] = useState(true);
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    });
  }, [items]);
  const uniqueIds = uniqueItems.map((item) => item.id);

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
          body: JSON.stringify({ format, teacher, publishedOnly }),
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
      <h2 className="font-serif text-xl font-semibold">组卷篮</h2>
      <p className="mt-2 text-sm text-[var(--ink-faint)]">
        只在本页有效，刷新或离开即清空。
      </p>
      {uniqueIds.length === 0 ? (
        <p className="mt-3 text-sm">篮是空的。</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {uniqueItems.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.publicId}</p>
                <p className="text-stone-900/70">{stemPreview(item.stemMd)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold"
              >
                移出
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          标题
          <input
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            className="mt-1 w-full border border-stone-900/20 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          格式
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
        教师版（含答案）
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publishedOnly}
          onChange={(event) => setPublishedOnly(event.currentTarget.checked)}
        />
        仅已上架
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
