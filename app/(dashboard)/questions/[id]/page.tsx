import { notFound } from "next/navigation";

import type { QuestionType } from "@prisma/client";

import { LockedPage } from "@/components/auth/locked-page";
import { OfficialQuestionEditor } from "@/components/question/official-question-editor";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import { listKnowledgePoints, listTags } from "@/lib/domain/taxonomy-repository";

export const dynamic = "force-dynamic";

export default async function OfficialQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <LockedPage />;
  }

  const { id } = await params;
  const [question, knowledgePoints, tags] = await Promise.all([
    prisma.question.findUnique({
      where: { id },
      include: {
        knowledgePoints: true,
        tags: true,
        versions: {
          select: { version: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    }),
    listKnowledgePoints(),
    listTags(),
  ]);

  if (!question) {
    notFound();
  }

  const optionsJson = Array.isArray(question.optionsJson)
    ? (question.optionsJson as Array<{ label: string; value: string }>)
    : null;
  const answerJson = question.answerJson as {
    type: string;
    value: string | string[];
  };

  return (
    <main id="main" className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <OfficialQuestionEditor
        question={{
          id: question.id,
          publicId: question.publicId,
          status: question.status,
          type: question.type as QuestionType,
          stemMd: question.stemMd,
          optionsJson,
          answerJson,
          solutionMd: question.solutionMd,
          difficulty: question.difficulty,
          knowledgePointIds: question.knowledgePoints.map(
            (link) => link.knowledgePointId,
          ),
          tagIds: question.tags.map((link) => link.tagId),
          version: question.versions[0]?.version ?? 1,
        }}
        knowledgePoints={knowledgePoints}
        tags={tags}
      />
    </main>
  );
}
