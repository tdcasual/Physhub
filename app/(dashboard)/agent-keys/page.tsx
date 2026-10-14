import { AgentKeyManager } from "@/components/agent-keys/agent-key-manager";
import { LockedPage } from "@/components/auth/locked-page";
import {
  canEditWorkbench,
  readEditorSessionFromCookies,
} from "@/lib/auth/human-auth";
import { listManagedApiKeys } from "@/lib/domain/api-key-repository";

export const dynamic = "force-dynamic";

export default async function AgentKeysPage() {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <LockedPage />;
  }

  if (!canEditWorkbench(session)) {
    return (
      <main id="main" className="min-h-[calc(100vh-4rem)] bg-[var(--paper)] px-6 py-16 text-[var(--ink)]">
        <div className="mx-auto w-full max-w-2xl border border-[var(--ink-border)] bg-[var(--paper-raised)] px-6 py-8">
          <h1 className="font-serif text-3xl font-semibold">密钥</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
            只有编辑可以管理 Agent 密钥。
          </p>
        </div>
      </main>
    );
  }

  const apiKeys = await listManagedApiKeys();

  return (
    <main id="main" className="min-h-[calc(100vh-4rem)] bg-[var(--paper)] text-[var(--ink)]">
      <AgentKeyManager initialKeys={apiKeys} />
    </main>
  );
}
