import { Prisma } from "@prisma/client";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { UnlockForm } from "@/components/auth/unlock-form";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const STEM_PREVIEW_LENGTH = 120;

const unpromotedDraftSelect = {
  id: true,
  status: true,
  stemMd: true,
  updatedAt: true,
} satisfies Prisma.QuestionDraftSelect;

type UnpromotedDraft = Prisma.QuestionDraftGetPayload<{
  select: typeof unpromotedDraftSelect;
}>;

function truncateStem(stemMd: string | null): string {
  const stem = stemMd?.replace(/\s+/g, " ").trim() ?? "";

  if (!stem) {
    return "Untitled draft";
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

async function getUnpromotedDrafts(): Promise<UnpromotedDraft[]> {
  return prisma.questionDraft.findMany({
    select: unpromotedDraftSelect,
    where: {
      status: {
        in: ["DRAFT", "NEEDS_REVIEW", "REJECTED"],
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 50,
  });
}

export default async function DraftsPage() {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <UnlockForm />;
  }

  const drafts = await getUnpromotedDrafts();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-stone-900/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
              Draft workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Drafts</h1>
          </div>
          <p className="text-sm text-stone-900/60">
            Unpromoted drafts only. Promoted items live under Questions.
          </p>
        </header>

        {drafts.length === 0 ? (
          <section className="border border-stone-900/15 bg-stone-50 p-6">
            <FileQuestion aria-hidden="true" className="size-6 text-orange-800" />
            <h2 className="mt-4 text-xl font-semibold">No unpromoted drafts.</h2>
            <p className="mt-2 max-w-2xl leading-7 text-stone-900/70">
              Drafts in DRAFT, NEEDS_REVIEW, or REJECTED will appear here.
            </p>
          </section>
        ) : (
          <section aria-label="Unpromoted drafts" className="space-y-4">
            {drafts.map((draft) => (
              <article
                key={draft.id}
                className="border border-stone-900/15 bg-stone-50 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      <Link
                        href={`/drafts/${draft.id}`}
                        className="hover:underline"
                      >
                        {truncateStem(draft.stemMd)}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-stone-900/60">
                      Updated {formatUpdatedAt(draft.updatedAt)}
                    </p>
                  </div>
                  <span className="border border-lime-800/25 bg-lime-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-lime-800">
                    {draft.status}
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
