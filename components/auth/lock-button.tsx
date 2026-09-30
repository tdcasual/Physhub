"use client";

import { Button } from "@/components/ui/button";

export function LockButton() {
  async function handleLock() {
    try {
      await fetch("/api/auth/login", {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        void handleLock();
      }}
    >
      锁定
    </Button>
  );
}
