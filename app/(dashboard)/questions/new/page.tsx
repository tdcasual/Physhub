import { UnlockForm } from "@/components/auth/unlock-form";
import { QuestionEditor } from "@/components/question/question-editor";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";

export default async function NewQuestionPage() {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <UnlockForm />;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <QuestionEditor />
    </main>
  );
}
