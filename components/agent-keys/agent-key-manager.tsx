"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ManagedApiKey } from "@/lib/domain/api-key-repository";
import { mapUiError } from "@/lib/ui/labels";

function formatWhen(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(key: ManagedApiKey) {
  if (key.kind === "dev-env") {
    return "本地开发";
  }

  if (key.revokedAt) {
    return "已吊销";
  }

  if (!key.copyable) {
    return "无法复制";
  }

  return "有效";
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  return mapUiError(payload?.error ?? "无法处理密钥");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.append(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

export function AgentKeyManager({
  initialKeys,
}: {
  initialKeys: ManagedApiKey[];
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const payload = (await response.json()) as {
        apiKey: ManagedApiKey;
        token: string;
      };

      setKeys((current) => [
        payload.apiKey,
        ...current.filter((item) => item.id !== payload.apiKey.id),
      ]);
      setIssuedToken(payload.token);
      setName("");
    } catch {
      setError("暂时无法签发，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function copyIssued() {
    if (!issuedToken) {
      return;
    }

    try {
      await copyText(issuedToken);
      setCopiedId("issued");
      setError(null);
    } catch {
      setError("暂时无法复制，请重试");
    }
  }

  async function copyKey(id: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/api-keys/${id}/reveal`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const payload = (await response.json()) as { token: string };
      await copyText(payload.token);
      setCopiedId(id);
    } catch {
      setError("暂时无法复制，请重试");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm("吊销后，使用这把密钥的 agent 将无法再访问。确定吊销？")) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/api-keys/${id}/revoke`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setError(await readError(response));
        return;
      }

      const payload = (await response.json()) as { apiKey: ManagedApiKey };
      setKeys((current) =>
        current.map((item) => (item.id === id ? payload.apiKey : item)),
      );
    } catch {
      setError("暂时无法吊销，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-3 border-b border-[var(--ink-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--patina)]">Agent</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">密钥</h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--ink-faint)]">
          只给 agent 用，不要发到群里。复制后贴到 harness 的
          <code className="mx-1">PHYSHUB_AGENT_KEY</code>。
        </p>
      </header>

      <form
        className="border border-[var(--ink-border)] bg-[var(--paper-raised)] p-5"
        onSubmit={(event) => void issue(event)}
      >
        <h2 className="font-serif text-xl font-semibold">签发新密钥</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          权限与现有 agent 工具相同，不能上架或删除题目。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm font-semibold" htmlFor="api-key-name">
            名称
            <input
              id="api-key-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="如：高一备课 agent"
              className="mt-2 min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper)] px-3 py-2 font-normal"
            />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            签发
          </Button>
        </div>
      </form>

      {issuedToken ? (
        <section
          aria-labelledby="issued-key-title"
          className="border border-[var(--seal)] bg-[var(--seal-soft)] p-5"
        >
          <h2 id="issued-key-title" className="font-serif text-xl font-semibold">
            新密钥
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            以后仍可在列表里复制。先复制一份放到 agent 配置里。
          </p>
          <label className="mt-4 block text-sm font-semibold" htmlFor="issued-key-token">
            明文
            <input
              id="issued-key-token"
              readOnly
              value={issuedToken}
              className="mt-2 min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper)] px-3 py-2 font-mono text-sm font-normal"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void copyIssued()}
            >
              {copiedId === "issued" ? "已复制" : "复制"}
            </Button>
            <Button type="button" onClick={() => setIssuedToken(null)}>
              收起
            </Button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p id="api-key-error" role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {keys.length === 0 ? (
        <EmptyState title="还没有 Agent 密钥">
          签发一把给备课用的 agent。本地开发也可以复制下面的开发密钥。
        </EmptyState>
      ) : (
        <section aria-label="密钥列表" className="space-y-3">
          {keys.map((key) => (
            <article
              key={key.id}
              className="border border-[var(--ink-border)] bg-[var(--paper-raised)] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-xl font-semibold">{key.name}</h2>
                    <span className="border border-[var(--ink-border)] px-2 py-1 text-xs font-semibold text-[var(--ink-soft)]">
                      {statusLabel(key)}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-sm text-[var(--ink-soft)]">
                    {key.prefix ? `${key.prefix}…` : "无前缀"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-faint)]">
                    {key.kind === "dev-env"
                      ? "来自环境变量 AGENT_API_KEY_DEV"
                      : `签发人 ${key.createdByUsername ?? "—"} · 创建 ${formatWhen(key.createdAt)}`}
                    {key.kind === "stored"
                      ? ` · 最后使用 ${key.lastUsedAt ? formatWhen(key.lastUsedAt) : "尚未使用"}`
                      : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busy || !key.copyable}
                    title={
                      key.copyable ? undefined : "签发时未保存明文，请重新签发"
                    }
                    onClick={() => void copyKey(key.id)}
                  >
                    {copiedId === key.id ? "已复制" : "复制"}
                  </Button>
                  {key.kind === "stored" && !key.revokedAt ? (
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void revokeKey(key.id)}
                    >
                      吊销
                    </Button>
                  ) : null}
                </div>
              </div>
              {!key.copyable ? (
                <p className="mt-3 text-sm text-[var(--ink-faint)]">
                  签发时未保存明文，请重新签发。
                </p>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
