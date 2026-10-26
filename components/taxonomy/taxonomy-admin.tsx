"use client";

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { flattenKnowledgePointTree } from "@/lib/domain/taxonomy-tree";
import { mapUiError } from "@/lib/ui/labels";

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
      setError(mapUiError(payload.error ?? "无法添加知识点"));
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
      setError(mapUiError(payload.error ?? "无法添加标签"));
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
      setError(mapUiError(payload.error ?? "无法保存知识点"));
      return;
    }

    window.location.reload();
  }

  async function remove(path: string) {
    if (!window.confirm("确定删除？被题目引用的节点不能删。")) {
      return;
    }

    setError(null);
    const response = await fetch(path, {
      method: "DELETE",
      credentials: "include",
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(mapUiError(payload.error ?? "无法删除"));
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8 lg:px-10">
      <h1 className="font-serif text-3xl font-semibold">知识点和标签</h1>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">知识点</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void createKnowledgePoint(event)}>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="kp-name">
            名称
            <input
              id="kp-name"
              required
              value={kpName}
              onChange={(event) => setKpName(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="kp-slug">
            slug
            <input
              id="kp-slug"
              required
              value={kpSlug}
              onChange={(event) => setKpSlug(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="kp-parent">
            父节点
            <select
              id="kp-parent"
              value={kpParentId}
              onChange={(event) => setKpParentId(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            >
              <option value="">根节点</option>
              {knowledgePoints.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">
            添加
          </Button>
        </form>
        <ul className="space-y-2">
          {tree.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 border border-[var(--ink-border)] bg-[var(--paper-mute)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              style={{ marginLeft: `${item.depth * 1.25}rem` }}
            >
              <span>
                {item.name} <span className="font-mono text-xs">{item.slug}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`${item.name} 的父节点`}
                  value={parentEdits[item.id] ?? item.parentId ?? ""}
                  onChange={(event) =>
                    setParentEdits((current) => ({
                      ...current,
                      [item.id]: event.currentTarget.value,
                    }))
                  }
                  className="min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-2 py-1 text-sm"
                >
                  <option value="">根节点</option>
                  {knowledgePoints
                    .filter((candidate) => candidate.id !== item.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                </select>
                <Button
                  type="button"
                  onClick={() => void saveParent(item)}
                >
                  保存
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void remove(`/api/knowledge-points/${item.id}`)}
                >
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">标签</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void createTag(event)}>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="tag-name">
            名称
            <input
              id="tag-name"
              required
              value={tagName}
              onChange={(event) => setTagName(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="tag-slug">
            slug
            <input
              id="tag-slug"
              required
              value={tagSlug}
              onChange={(event) => setTagSlug(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-[var(--ink-soft)]" htmlFor="tag-group">
            分组
            <input
              id="tag-group"
              value={tagGroup}
              onChange={(event) => setTagGroup(event.currentTarget.value)}
              className="mt-1 block min-h-11 border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
            />
          </label>
          <Button type="submit" variant="primary">
            添加
          </Button>
        </form>
        <ul className="space-y-2">
          {tags.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 border border-[var(--ink-border)] bg-[var(--paper-mute)] px-3 py-2">
              <span>
                {item.name} <span className="font-mono text-xs">{item.slug}</span>
              </span>
              <Button
                type="button"
                variant="danger"
                onClick={() => void remove(`/api/tags/${item.id}`)}
              >
                删除
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
