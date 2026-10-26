import Link from "next/link";

import { LockedPage } from "@/components/auth/locked-page";
import { EmptyState } from "@/components/ui/empty-state";
import { Stamp } from "@/components/ui/stamp";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  UNPROMOTED_PAGE_SIZE,
  countUnpromotedDraftsByStatus,
  listUnpromotedDrafts,
  parseUnpromotedDraftPage,
  parseUnpromotedDraftStatus,
} from "@/lib/domain/draft-listing";
import { labelDraftStatus } from "@/lib/ui/labels";

export const dynamic = "force-dynamic";

const STEM_PREVIEW_LENGTH = 120;

function truncateStem(stemMd: string | null): string {
  const stem = stemMd?.replace(/\s+/g, " ").trim() ?? "";

  if (!stem) {
    return "未写题干";
  }

  if (stem.length <= STEM_PREVIEW_LENGTH) {
    return stem;
  }

  return `${stem.slice(0, STEM_PREVIEW_LENGTH).trimEnd()}…`;
}

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function draftsHref(status: string, page: number) {
  const params = new URLSearchParams();

  if (status !== "NEEDS_REVIEW") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/drafts?${query}` : "/drafts";
}

export default async function DraftsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string }>;
} = {}) {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <LockedPage />;
  }

  const params = (await searchParams) ?? {};
  const filter = parseUnpromotedDraftStatus(params.status);
  const requestedPage = parseUnpromotedDraftPage(params.page);
  const counts = await countUnpromotedDraftsByStatus(prisma);
  const totalForFilter = counts[filter];
  const totalPages = Math.max(1, Math.ceil(totalForFilter / UNPROMOTED_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = await listUnpromotedDrafts(prisma, filter, { page });

  const filters = [
    { status: "NEEDS_REVIEW", label: "待审", count: counts.NEEDS_REVIEW },
    { status: "DRAFT", label: "草稿", count: counts.DRAFT },
    { status: "REJECTED", label: "已退回", count: counts.REJECTED },
  ] as const;

  return (
    <main
      id="main"
      className="min-h-[calc(100vh-4rem)] bg-[var(--paper)] text-[var(--ink)]"
    >
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-[var(--ink-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--patina)]">审稿</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">工作台</h1>
          </div>
          <p className="text-sm text-[var(--ink-faint)]">
            已入库的题在题库里。
          </p>
        </header>

        <nav aria-label="草稿筛选" className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const href = draftsHref(item.status, 1);
            const current = filter === item.status;

            return (
              <Link
                key={item.status}
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border px-3 text-sm font-semibold ${
                  current
                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                    : "border-[var(--ink-border)] bg-[var(--paper-raised)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
                <span className="ml-2 font-normal tabular-nums">{item.count}</span>
              </Link>
            );
          })}
        </nav>

        {visible.length === 0 ? (
          <EmptyState
            title={filter === "NEEDS_REVIEW" ? "暂无待审稿" : "这一栏是空的"}
            action={
              <Link
                href="/questions/new"
                className="inline-flex min-h-11 items-center border border-[var(--seal)] bg-[var(--seal)] px-4 text-sm font-semibold text-[var(--paper)]"
              >
                去录入
              </Link>
            }
          >
            {filter === "NEEDS_REVIEW"
              ? "Agent 交来的题会出现在这里。也可以自己录入。"
              : "切换上方筛选项，或去录入一题。"}
          </EmptyState>
        ) : (
          <section aria-label="草稿列表" className="space-y-3">
            {visible.map((draft) => (
              <article
                key={draft.id}
                className="border border-[var(--ink-border)] bg-[var(--paper-raised)] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-semibold">
                      <Link href={`/drafts/${draft.id}`} className="hover:underline">
                        {truncateStem(draft.stemMd)}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-[var(--ink-faint)]">
                      {draft.agentRuns.length > 0 ? "来自 agent" : "手录"}
                      {" · "}
                      {formatUpdatedAt(draft.updatedAt)}
                    </p>
                  </div>
                  <Stamp status={draft.status}>
                    {labelDraftStatus(draft.status)}
                  </Stamp>
                </div>
              </article>
            ))}
            {totalForFilter > UNPROMOTED_PAGE_SIZE ? (
              <nav
                aria-label="草稿分页"
                className="flex flex-wrap items-center gap-3 pt-2 text-sm"
              >
                {page > 1 ? (
                  <Link
                    href={draftsHref(filter, page - 1)}
                    className="inline-flex min-h-11 items-center border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 font-semibold"
                  >
                    上一页
                  </Link>
                ) : null}
                <span className="text-[var(--ink-soft)]">
                  第 {page} / {totalPages} 页
                </span>
                {page < totalPages ? (
                  <Link
                    href={draftsHref(filter, page + 1)}
                    className="inline-flex min-h-11 items-center border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 font-semibold"
                  >
                    下一页
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
