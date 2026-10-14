import { LockedPage } from "@/components/auth/locked-page";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <LockedPage />;
  }

  return children;
}
