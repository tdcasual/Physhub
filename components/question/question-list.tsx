import { FileQuestion, Tags } from "lucide-react";

import { MarkdownLatex } from "@/lib/renderer/render-markdown";

export type QuestionListItem = {
  id: string;
  publicId: string;
  type: string;
  status: string;
  stemMd: string;
  difficulty: number | null;
  updatedAt: string;
  primaryKnowledgePointName: string | null;
  tagNames: string[];
};

function formatEnumLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function QuestionList({ questions }: { questions: QuestionListItem[] }) {
  if (questions.length === 0) {
    return (
      <section className="border border-stone-900/15 bg-stone-50 p-6">
        <FileQuestion aria-hidden="true" className="size-6 text-orange-800" />
        <h2 className="mt-4 text-xl font-semibold">No questions yet.</h2>
        <p className="mt-2 max-w-2xl leading-7 text-stone-900/70">
          Reviewed and published questions will appear here after they are added
          to the bank.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Recent questions" className="space-y-4">
      {questions.map((question) => (
        <article
          key={question.id}
          className="border border-stone-900/15 bg-stone-50 p-5"
        >
          <div className="flex flex-col gap-3 border-b border-stone-900/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{question.publicId}</h2>
              <p className="mt-1 text-sm text-stone-900/60">
                Updated {formatUpdatedAt(question.updatedAt)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
              <span className="border border-lime-800/25 bg-lime-50 px-2 py-1 text-lime-800">
                {question.status}
              </span>
              <span className="border border-stone-900/15 bg-white px-2 py-1 text-stone-700">
                {formatEnumLabel(question.type)}
              </span>
              {question.difficulty ? (
                <span className="border border-orange-800/25 bg-orange-50 px-2 py-1 text-orange-800">
                  Difficulty {question.difficulty}
                </span>
              ) : null}
            </div>
          </div>

          <div className="prose prose-stone mt-4 max-w-none">
            <MarkdownLatex content={question.stemMd} />
          </div>

          <footer className="mt-4 flex flex-wrap items-center gap-2 text-sm text-stone-900/70">
            {question.primaryKnowledgePointName ? (
              <span className="border border-stone-900/15 bg-white px-2 py-1 font-medium text-stone-900">
                {question.primaryKnowledgePointName}
              </span>
            ) : null}
            {question.tagNames.length > 0 ? (
              <span className="inline-flex items-center gap-2">
                <Tags aria-hidden="true" className="size-4 text-stone-900/50" />
                {question.tagNames.map((tagName) => (
                  <span
                    key={`${question.id}-${tagName}`}
                    className="border border-stone-900/15 bg-white px-2 py-1"
                  >
                    {tagName}
                  </span>
                ))}
              </span>
            ) : null}
          </footer>
        </article>
      ))}
    </section>
  );
}
