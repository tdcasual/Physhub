import { Prisma } from "@prisma/client";
import Link from "next/link";

import {
  QuestionList,
  type QuestionListItem,
} from "@/components/question/question-list";
import { QuestionSearchPanel } from "@/components/search/question-search-panel";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const recentQuestionSelect = {
  id: true,
  publicId: true,
  type: true,
  status: true,
  stemMd: true,
  difficulty: true,
  updatedAt: true,
  primaryKnowledgePoint: {
    select: {
      name: true,
    },
  },
  tags: {
    select: {
      tag: {
        select: {
          name: true,
        },
      },
    },
  },
} satisfies Prisma.QuestionSelect;

type RecentQuestion = Prisma.QuestionGetPayload<{
  select: typeof recentQuestionSelect;
}>;

function toQuestionListItem(question: RecentQuestion): QuestionListItem {
  return {
    id: question.id,
    publicId: question.publicId,
    type: question.type,
    status: question.status,
    stemMd: question.stemMd,
    difficulty: question.difficulty,
    updatedAt: question.updatedAt.toISOString(),
    primaryKnowledgePointName: question.primaryKnowledgePoint?.name ?? null,
    tagNames: question.tags.map((link) => link.tag.name),
  };
}

async function getRecentQuestions(): Promise<QuestionListItem[]> {
  const questions = await prisma.question.findMany({
    select: recentQuestionSelect,
    where: {
      status: {
        in: ["REVIEWED", "PUBLISHED"],
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 50,
  });

  return questions.map(toQuestionListItem);
}

export default async function QuestionsPage() {
  const questions = await getRecentQuestions();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-stone-900/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
              Question bank
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Questions</h1>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="/drafts"
                className="border border-stone-900/20 bg-white px-3 py-2 text-stone-900 hover:bg-stone-100"
              >
                Drafts
              </Link>
              <Link
                href="/questions/new"
                className="border border-stone-900/20 bg-stone-950 px-3 py-2 text-white hover:bg-stone-800"
              >
                New draft
              </Link>
            </div>
            <p className="text-sm text-stone-900/60">
              Showing the 50 most recently updated questions.
            </p>
          </div>
        </header>

        <QuestionSearchPanel />
        <QuestionList questions={questions} />
      </div>
    </main>
  );
}
