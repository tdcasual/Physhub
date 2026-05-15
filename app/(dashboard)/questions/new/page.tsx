import { QuestionEditor } from "@/components/question/question-editor";

export default function NewQuestionPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <QuestionEditor />
    </main>
  );
}
