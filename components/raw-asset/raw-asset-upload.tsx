"use client";

import { useState } from "react";

import { mapUiError } from "@/lib/ui/labels";

export function RawAssetUpload({
  onUploaded,
}: {
  onUploaded: (rawAssetId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/raw-assets", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = (await response.json()) as {
        error?: string;
        rawAsset?: { id?: string };
      };

      if (!response.ok || !payload.rawAsset?.id) {
        setError(mapUiError(payload.error ?? "Unable to create raw asset"));
        return;
      }

      setAssetId(payload.rawAsset.id);
      onUploaded(payload.rawAsset.id);
    } catch {
      setError("无法上传");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--ink-soft)]">
        来源图片或文本文件
        <input
          type="file"
          className="mt-2 block w-full text-sm"
          disabled={uploading}
          onChange={(event) => {
            void handleFile(event.currentTarget.files?.[0]);
          }}
        />
      </label>
      {assetId ? (
        <p className="text-sm text-[var(--ink-soft)]">已关联来源 {assetId}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
