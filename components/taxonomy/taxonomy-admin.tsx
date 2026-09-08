"use client";

import { FormEvent, useMemo, useState } from "react";

import { flattenKnowledgePointTree } from "@/lib/domain/taxonomy-tree";

type KnowledgePoint = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
};

type Tag = {
  id: string;
  name: string;
  slug: string;
  group: string | null;
};

export function TaxonomyAdmin({
  knowledgePoints,
  tags,
}: {
  knowledgePoints: KnowledgePoint[];
  tags: Tag[];
}) {
  const [kpName, setKpName] = useState("");
  const [kpSlug, setKpSlug] = useState("");
  const [kpParentId, setKpParentId] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagSlug, setTagSlug] = useState("");
  const [tagGroup, setTagGroup] = useState("");
  const [parentEdits, setParentEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const tree = useMemo(
    () => flattenKnowledgePointTree(
      knowledgePoints.map((item) => ({ ...item, sortOrder: item.sortOrder ?? 0 })),
    ),
    [knowledgePoints],
  );

  async function createKnowledgePoint(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/knowledge-points", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: kpName,
        slug: kpSlug,
        ...(kpParentId ? { parentId: kpParentId } : {}),
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to create knowledge point");
      return;
    }

    window.location.reload();
  }

  async function createTag(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/tags", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: tagName,
        slug: tagSlug,
        group: tagGroup || null,
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to create tag");
      return;
    }

    window.location.reload();
  }

  async function saveParent(item: KnowledgePoint) {
    setError(null);
    const nextParent = parentEdits[item.id] ?? item.parentId ?? "";
    const response = await fetch(`/api/knowledge-points/${item.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        slug: item.slug,
        parentId: nextParent === "" ? null : nextParent,
      }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to update knowledge point");
      return;
    }

    window.location.reload();
  }

  async function remove(path: string) {
    setError(null);
    const response = await fetch(path, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to delete");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 lg:px-10">
      <h1 className="text-3xl font-semibold">Knowledge points and tags</h1>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Knowledge points</h2>
        <form className="flex flex-wrap gap-3" onSubmit={(event) => void createKnowledgePoint(event)}>
          <input
            required
            placeholder="Name"
            value={kpName}
            onChange={(event) => setKpName(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
          />
          <input
            required
            placeholder="Slug"
            value={kpSlug}
            onChange={(event) => setKpSlug(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
          />
          <select
            value={kpParentId}
            onChange={(event) => setKpParentId(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
            aria-label="Parent knowledge point"
          >
            <option value="">Root</option>
            {knowledgePoints.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="submit" className="border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-semibold text-white">
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {tree.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 border border-stone-900/10 bg-stone-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              style={{ marginLeft: `${item.depth * 1.25}rem` }}
            >
              <span>
                {item.name} <span className="font-mono text-xs">{item.slug}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Parent for ${item.name}`}
                  value={parentEdits[item.id] ?? item.parentId ?? ""}
                  onChange={(event) =>
                    setParentEdits((current) => ({
                      ...current,
                      [item.id]: event.currentTarget.value,
                    }))
                  }
                  className="border border-stone-900/20 px-2 py-1 text-sm"
                >
                  <option value="">Root</option>
                  {knowledgePoints
                    .filter((candidate) => candidate.id !== item.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveParent(item)}
                  className="text-sm font-semibold"
                >
                  Save parent
                </button>
                <button
                  type="button"
                  onClick={() => void remove(`/api/knowledge-points/${item.id}`)}
                  className="text-sm font-semibold"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Tags</h2>
        <form className="flex flex-wrap gap-3" onSubmit={(event) => void createTag(event)}>
          <input
            required
            placeholder="Name"
            value={tagName}
            onChange={(event) => setTagName(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
          />
          <input
            required
            placeholder="Slug"
            value={tagSlug}
            onChange={(event) => setTagSlug(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
          />
          <input
            placeholder="Group"
            value={tagGroup}
            onChange={(event) => setTagGroup(event.currentTarget.value)}
            className="border border-stone-900/20 px-3 py-2"
          />
          <button type="submit" className="border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-semibold text-white">
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {tags.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border border-stone-900/10 bg-stone-50 px-3 py-2">
              <span>
                {item.name} <span className="font-mono text-xs">{item.slug}</span>
              </span>
              <button
                type="button"
                onClick={() => void remove(`/api/tags/${item.id}`)}
                className="text-sm font-semibold"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
