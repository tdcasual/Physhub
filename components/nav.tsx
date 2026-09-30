"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LockButton } from "@/components/auth/lock-button";
import { navLinks } from "@/lib/ui/labels";

export function Nav({
  unlocked = false,
  username,
}: {
  unlocked?: boolean;
  username?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="border-b border-[var(--ink-border)] bg-[var(--paper)]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 lg:px-10">
        <Link
          href={unlocked ? "/drafts" : "/"}
          className="inline-flex min-h-11 items-center font-serif text-lg font-semibold text-[var(--patina)]"
        >
          Physhub
        </Link>
        <ul className="flex flex-wrap items-center gap-1 text-sm font-semibold">
          {navLinks.map((link) => {
            const current =
              pathname === link.href ||
              (link.href !== "/questions/new" &&
                link.href !== "/questions" &&
                pathname.startsWith(`${link.href}/`)) ||
              (link.href === "/questions" &&
                pathname.startsWith("/questions/") &&
                pathname !== "/questions/new");

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center px-2 ${
                    current
                      ? "text-[var(--ink)] underline decoration-[var(--seal)] decoration-2 underline-offset-8"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {unlocked ? (
          <div className="ml-auto flex items-center gap-3">
            {username ? (
              <span className="text-sm text-[var(--ink-soft)]">{username}</span>
            ) : null}
            <LockButton />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
