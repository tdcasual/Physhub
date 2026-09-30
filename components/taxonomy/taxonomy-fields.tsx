"use client";

import type { QuestionType } from "@prisma/client";

import { flattenKnowledgePointTree } from "@/lib/domain/taxonomy-tree";
import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";
import { questionTypeLabel } from "@/lib/ui/labels";

const questionTypes: QuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "FILL_BLANK",
  "EXPERIMENT",
  "CALCULATION",
  "PROOF",
  "IMAGE_ANALYSIS",
];

export type TaxonomyFieldsValue = {
  knowledgePointIds: string[];
  tagIds: string[];
  difficulty: number | null;
  type: QuestionType | "";
};

function formatEnumLabel(value: QuestionType) {
  return questionTypeLabel[value];
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function groupedTags(tags: TagDto[]) {
  const groups = new Map<string, TagDto[]>();

  for (const tag of tags) {
    const key = tag.group?.trim() || "未分组";
    const list = groups.get(key) ?? [];
    list.push(tag);
    groups.set(key, list);
  }

  return [...groups.entries()];
}

export function TaxonomyFields({
  knowledgePoints,
  tags,
  value,
  disabled = false,
  onChange,
}: {
  knowledgePoints: KnowledgePointDto[];
  tags: TagDto[];
  value: TaxonomyFieldsValue;
  disabled?: boolean;
  onChange: (next: TaxonomyFieldsValue) => void;
}) {
  const tree = flattenKnowledgePointTree(knowledgePoints);
  const tagGroups = groupedTags(tags);

  return (
    <section className="space-y-4 border border-[var(--ink-border)] bg-[var(--paper-mute)] p-4">
      <h2 className="font-serif text-lg font-semibold">分类</h2>
      <label className="block space-y-1 text-sm font-medium text-[var(--ink-soft)]">
        题型
        <select
          value={value.type}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              type: event.currentTarget.value as QuestionType | "",
            })
          }
          className="mt-1 min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
        >
          <option value="">未分类</option>
          {questionTypes.map((type) => (
            <option key={type} value={type}>
              {formatEnumLabel(type)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm font-medium text-[var(--ink-soft)]">
        难度
        <select
          value={value.difficulty ?? ""}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            onChange({
              ...value,
              difficulty: raw === "" ? null : Number(raw),
            });
          }}
          className="mt-1 min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2 text-[var(--ink)] disabled:bg-[var(--paper-mute)]"
        >
          <option value="">未设</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-[var(--ink-soft)]">
          知识点
        </legend>
        {tree.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)]">
            还没有知识点。请到「知识点」里添加。
          </p>
        ) : (
          <ul className="space-y-1">
            {tree.map((node) => (
              <li key={node.id} style={{ paddingLeft: `${node.depth * 1.25}rem` }}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={value.knowledgePointIds.includes(node.id)}
                    onChange={() =>
                      onChange({
                        ...value,
                        knowledgePointIds: toggleId(value.knowledgePointIds, node.id),
                      })
                    }
                  />
                  <span>{node.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium text-[var(--ink-soft)]">标签</legend>
        {tagGroups.length === 0 ? (
          <p className="text-sm text-[var(--ink-faint)]">还没有标签。</p>
        ) : (
          tagGroups.map(([group, groupTags]) => (
            <div key={group} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-900/55">
                {group}
              </p>
              <ul className="space-y-1">
                {groupTags.map((tag) => (
                  <li key={tag.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={value.tagIds.includes(tag.id)}
                        onChange={() =>
                          onChange({
                            ...value,
                            tagIds: toggleId(value.tagIds, tag.id),
                          })
                        }
                      />
                      <span>{tag.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </fieldset>
    </section>
  );
}
