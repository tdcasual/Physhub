"use client";

export function LockButton() {
  async function handleLock() {
    try {
      await fetch("/api/auth/editor-session", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleLock();
      }}
      className="inline-flex min-h-11 items-center border border-stone-900/20 bg-white px-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
    >
      Lock
    </button>
  );
}
