import { MarkdownLatex } from "@/lib/renderer/render-markdown";

type Option = {
  label: string;
  value: string;
};

export function QuestionPreview({
  stemMd,
  options = [],
  solutionMd,
  showSolution = false,
}: {
  stemMd: string;
  options?: Option[];
  solutionMd?: string | null;
  showSolution?: boolean;
}) {
  return (
    <article className="space-y-4 rounded border border-slate-200 bg-white p-4">
      <div className="prose prose-slate max-w-none">
        <MarkdownLatex content={stemMd} />
      </div>

      {options.length > 0 ? (
        <div className="grid gap-2">
          {options.map((option, index) => (
            <div key={`${index}-${option.label}`} className="flex gap-2">
              <span className="font-semibold">{option.label}.</span>
              <div className="prose prose-slate max-w-none">
                <MarkdownLatex content={option.value} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showSolution && solutionMd ? (
        <section className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-700">解析</h3>
          <div className="prose prose-slate max-w-none">
            <MarkdownLatex content={solutionMd} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
