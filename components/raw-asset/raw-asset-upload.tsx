"use client";

import { useState } from "react";

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
        setError(payload.error ?? "Unable to upload");
        return;
      }

      setAssetId(payload.rawAsset.id);
      onUploaded(payload.rawAsset.id);
    } catch {
      setError("Unable to upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-900/70">
        Source image or text file
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
        <p className="text-sm text-stone-900/70">Attached raw asset {assetId}</p>
      ) : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
