import { notFound } from "next/navigation";

import { UnlockForm } from "@/components/auth/unlock-form";
import { OfficialQuestionEditor } from "@/components/question/official-question-editor";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function OfficialQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <UnlockForm />;
  }

  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      knowledgePoints: true,
      tags: true,
    },
  });

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
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <OfficialQuestionEditor
        question={{
          id: question.id,
          publicId: question.publicId,
          status: question.status,
          type: question.type,
          stemMd: question.stemMd,
          optionsJson,
          answerJson,
          solutionMd: question.solutionMd,
          difficulty: question.difficulty,
          knowledgePointIds: question.knowledgePoints.map(
            (link) => link.knowledgePointId,
          ),
          tagIds: question.tags.map((link) => link.tagId),
        }}
      />
    </main>
  );
}
