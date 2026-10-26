"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { mapUiError } from "@/lib/ui/labels";

export function UnlockForm({
  headingLevel = 2,
}: {
  headingLevel?: 1 | 2;
} = {}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(mapUiError(payload?.error ?? "Unauthorized"));
        return;
      }

      window.location.reload();
    } catch {
      setError(mapUiError("Unable to unlock"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg border border-[var(--ink-border)] bg-[var(--paper-raised)] px-6 py-8">
      <p className="text-sm font-medium text-[var(--patina)]">老师</p>
      <Heading className="mt-2 font-serif text-3xl font-semibold">登录</Heading>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
        使用帐号和密码进入工作台。草稿和答案仅登录后可见。
      </p>
      <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <label className="block text-sm font-semibold" htmlFor="login-username">
          帐号
        </label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          spellCheck={false}
          value={username}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          onChange={(event) => setUsername(event.currentTarget.value)}
          className="min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
        />
        <label className="block text-sm font-semibold" htmlFor="login-password">
          密码
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          onChange={(event) => setPassword(event.currentTarget.value)}
          className="min-h-11 w-full border border-[var(--ink-border)] bg-[var(--paper-raised)] px-3 py-2"
        />
        <Button type="submit" variant="primary" disabled={submitting}>
          登录
        </Button>
        {error ? (
          <p id="login-error" role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
