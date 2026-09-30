import { redirect } from "next/navigation";
import Link from "next/link";

import { UnlockForm } from "@/components/auth/unlock-form";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";

export default async function Home() {
  const session = await readEditorSessionFromCookies();

  if (session) {
    redirect("/drafts");
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--patina)]">高中物理</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
            题库工作台
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
            整理已有试题、审稿入库、按知识点检索。平台不内置大模型；最终内容由老师确认。
          </p>
          <Link
            href="/questions/new"
            className="mt-8 inline-flex min-h-11 items-center border border-[var(--seal)] bg-[var(--seal)] px-4 text-sm font-semibold text-[var(--paper)] hover:bg-[var(--seal-hover)]"
          >
            去录入
          </Link>
        </div>
        <UnlockForm />
      </section>
    </main>
  );
}
