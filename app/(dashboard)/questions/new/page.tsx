import { UnlockForm } from "@/components/auth/unlock-form";
import { QuestionEditor } from "@/components/question/question-editor";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { listKnowledgePoints, listTags } from "@/lib/domain/taxonomy-repository";

export default async function NewQuestionPage() {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <UnlockForm />;
  }

  const [knowledgePoints, tags] = await Promise.all([
    listKnowledgePoints(),
    listTags(),
  ]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <QuestionEditor knowledgePoints={knowledgePoints} tags={tags} />
    </main>
  );
}
