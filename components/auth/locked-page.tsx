import { UnlockForm } from "@/components/auth/unlock-form";

export function LockedPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[var(--paper)] px-6 py-16">
      <UnlockForm />
    </main>
  );
}
