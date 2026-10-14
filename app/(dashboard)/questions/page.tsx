import { Prisma } from "@prisma/client";

import { LockedPage } from "@/components/auth/locked-page";
import { QuestionsWorkbench } from "@/components/question/questions-workbench";
import { type QuestionListItem } from "@/components/question/question-list";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
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
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <LockedPage />;
  }

  const questions = await getRecentQuestions();

  return (
    <main id="main" className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-3 border-b border-[var(--ink-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--patina)]">已审定 / 已上架</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">题库</h1>
          </div>
          <p className="text-sm text-[var(--ink-faint)]">
            默认列出最近 50 题。可用中文检索。组卷篮只在本页有效，离开即清空。
          </p>
        </header>

        <QuestionsWorkbench questions={questions} />
      </div>
    </main>
  );
}
