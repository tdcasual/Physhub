import Link from "next/link";
import { Atom, BookOpenCheck, PencilLine, SearchCheck } from "lucide-react";

const workflow = [
  {
    title: "Curate",
    detail:
      "Bring existing physics questions into drafts. Official items enter the bank only after human review.",
    icon: BookOpenCheck,
  },
  {
    title: "Classify",
    detail:
      "External harnesses suggest topic, difficulty, and tags. Confirmed metadata stays human-owned; the workbench does not generate questions.",
    icon: Atom,
  },
  {
    title: "Retrieve",
    detail:
      "Search the reviewed bank with precise filters. Agents use the tool API; the app does not embed a model.",
    icon: SearchCheck,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
        <div className="grid gap-12 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-orange-800">
              Reviewed questions, searchable structure
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">
              A cloud workbench for teacher-owned physics question curation.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-900/70">
              The workbench organizes existing teacher-owned questions for
              classification, quality checks, and precise search. External agents
              can assist with structure and retrieval; the platform does not embed
              an LLM, and final content stays under human review.
            </p>
            <Link
              href="/questions/new"
              className="mt-8 inline-flex items-center gap-2 border border-stone-900/20 bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            >
              <PencilLine aria-hidden="true" className="size-4" />
              New draft
            </Link>
          </div>

          <aside className="border-l-4 border-orange-800 bg-sky-100/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-800">
              Current layer
            </p>
            <p className="mt-4 text-3xl font-semibold">Harness-first workbench</p>
            <p className="mt-4 leading-7 text-stone-900/70">
              Unlock the editor, save drafts, promote official questions, and
              search the bank. External harnesses write drafts only; humans
              publish.
            </p>
          </aside>
        </div>

        <div className="grid gap-4 pb-4 md:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.title} className="border border-stone-900/15 bg-stone-50 p-5">
              <item.icon aria-hidden="true" className="mb-5 size-6 text-orange-800" />
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 leading-7 text-stone-900/70">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
