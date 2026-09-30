const tones: Record<string, string> = {
  DRAFT: "border-[var(--stamp-draft-border)] bg-[var(--stamp-draft)] text-[var(--ink-soft)]",
  NEEDS_REVIEW:
    "border-[var(--stamp-review-border)] bg-[var(--stamp-review)] text-[var(--stamp-review-ink)]",
  REJECTED: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
  PROMOTED: "border-[var(--seal)] bg-[var(--seal-soft)] text-[var(--seal)]",
  REVIEWED: "border-[var(--patina)] bg-[var(--patina-soft)] text-[var(--patina)]",
  PUBLISHED: "border-[var(--patina)] bg-[var(--patina)] text-[var(--paper)]",
  DEPRECATED: "border-[var(--ink-border)] bg-[var(--paper-mute)] text-[var(--ink-faint)] line-through",
};

export function Stamp({
  status,
  children,
}: {
  status: string;
  children: string;
}) {
  return (
    <span
      className={`inline-flex min-h-8 items-center border px-2 text-xs font-semibold tracking-wide ${tones[status] ?? tones.DRAFT}`}
    >
      {children}
    </span>
  );
}
