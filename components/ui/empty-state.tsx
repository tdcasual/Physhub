import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border border-[var(--ink-border)] bg-[var(--paper-raised)] px-6 py-8">
      <h2 className="font-serif text-xl font-semibold text-[var(--ink)]">{title}</h2>
      <div className="mt-2 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
        {children}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
