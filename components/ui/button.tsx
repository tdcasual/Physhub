import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "border-[var(--seal)] bg-[var(--seal)] text-[var(--paper)] hover:bg-[var(--seal-hover)]",
  secondary:
    "border-[var(--ink-border)] bg-[var(--paper-raised)] text-[var(--ink)] hover:bg-[var(--paper-mute)]",
  ghost:
    "border-transparent bg-transparent text-[var(--ink)] hover:bg-[var(--paper-mute)]",
  danger:
    "border-[var(--danger)] bg-[var(--paper-raised)] text-[var(--danger)] hover:bg-[var(--danger-soft)]",
} as const;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
