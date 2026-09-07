"use client";

import { FormEvent, useState } from "react";

export function UnlockForm() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/editor-session", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unauthorized");
        return;
      }

      window.location.reload();
    } catch {
      setError("Unable to unlock");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-800">
          Editor session
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Unlock editor</h1>
        <p className="mt-3 text-sm leading-6 text-stone-900/70">
          Enter the editor secret to open the workbench. Drafts and answers stay
          hidden until the session cookie is set.
        </p>
        <form className="mt-8 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block text-sm font-semibold" htmlFor="editor-secret">
            Editor secret
          </label>
          <input
            id="editor-secret"
            name="secret"
            type="password"
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="w-full border border-stone-900/20 bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="border border-stone-900/20 bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
          >
            Unlock
          </button>
          {error ? (
            <p role="alert" className="text-sm text-orange-800">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
