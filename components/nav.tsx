import Link from "next/link";

const links = [
  { href: "/questions", label: "Questions" },
  { href: "/drafts", label: "Drafts" },
  { href: "/questions/new", label: "New draft" },
  { href: "/taxonomy", label: "Taxonomy" },
] as const;

export function Nav() {
  return (
    <nav
      aria-label="Main"
      className="border-b border-stone-900/15 bg-[var(--background)]"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-3 lg:px-10">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-800"
        >
          Physhub
        </Link>
        <ul className="flex items-center gap-4 text-sm font-semibold">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-stone-900/80 hover:text-stone-950"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
