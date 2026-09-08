import Link from "next/link";

import { LockButton } from "@/components/auth/lock-button";

const links = [
  { href: "/questions", label: "Questions" },
  { href: "/drafts", label: "Drafts" },
  { href: "/questions/new", label: "New draft" },
  { href: "/taxonomy", label: "Taxonomy" },
] as const;

export function Nav({ unlocked = false }: { unlocked?: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="border-b border-stone-900/15 bg-[var(--background)]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 lg:px-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-[0.18em] text-lime-800"
        >
          Physhub
        </Link>
        <ul className="flex flex-wrap items-center gap-1 text-sm font-semibold">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-flex min-h-11 items-center px-2 text-stone-900/80 hover:text-stone-950"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {unlocked ? (
          <div className="ml-auto">
            <LockButton />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
