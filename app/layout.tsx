import type { Metadata } from "next";

import { Nav } from "@/components/nav";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Physhub",
  description: "Cloud workbench for curating existing high-school physics questions.",
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
        <Nav unlocked={Boolean(session)} />
        {children}
      </body>
    </html>
  );
}
