import { Atom, BookOpenCheck, DatabaseZap, SearchCheck } from "lucide-react";

const workflow = [
  {
    title: "Curate",
    detail: "Ingest original material and keep every question tied to a human-owned review state.",
    icon: BookOpenCheck,
  },
  {
    title: "Classify",
    detail: "Record topic, difficulty, source, and AI suggestions without overwriting confirmed metadata.",
    icon: Atom,
  },
  {
    title: "Retrieve",
    detail: "Prepare clean structures for precise teacher search and future agent-safe APIs.",
    icon: SearchCheck,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-stone-900/15 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center border border-stone-900/20 bg-sky-100 text-stone-900">
              <DatabaseZap aria-hidden="true" className="size-5" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-800">
              Physics Question Bank
            </span>
          </div>
          <span className="text-sm text-stone-900/60">MVP foundation</span>
        </header>

        <div className="grid gap-12 py-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-orange-800">
              Reviewed questions, searchable structure
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">
              A cloud workbench for teacher-owned physics question curation.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-900/70">
              The backend starts with clear boundaries: AI may assist sorting,
              checking, and retrieval, while final publishing remains a human
              review action.
            </p>
          </div>

          <aside className="border-l-4 border-orange-800 bg-sky-100/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-800">
              Current layer
            </p>
            <p className="mt-4 text-3xl font-semibold">Next.js App Router</p>
            <p className="mt-4 leading-7 text-stone-900/70">
              TypeScript, Tailwind, linting, and package foundations are ready
              for database, renderer, and worker modules.
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
