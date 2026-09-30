"use client";

import { useState, type ReactNode } from "react";

export function TechDetails({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border border-[var(--ink-border)] bg-[var(--paper-mute)] p-4">
      <button
        type="button"
        className="text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {summary}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
