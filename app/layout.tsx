import type { Metadata } from "next";

import { Nav } from "@/components/nav";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Physhub",
  description: "高中物理题库工作台：整理已有试题、审稿入库、按知识点检索。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await readEditorSessionFromCookies();

  return (
    <html lang="zh-CN" style={{ colorScheme: "light" }}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-[var(--ink)] focus:bg-[var(--paper-raised)] focus:px-4 focus:py-2"
        >
          跳到主内容
        </a>
        <Nav unlocked={Boolean(session)} username={session?.username} />
        {children}
      </body>
    </html>
  );
}
