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
    <html lang="zh-CN">
      <body>
        <Nav unlocked={Boolean(session)} username={session?.username} />
        {children}
      </body>
    </html>
  );
}
