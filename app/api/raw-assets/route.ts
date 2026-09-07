import type { RawAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { createRawAsset } from "@/lib/domain/raw-asset-repository";
import { buildStorageKey, saveLocalUpload } from "@/lib/storage/storage-service";

const pastedTextName = "pasted-text.txt";
const textMimeType = "text/plain";

export function detectRawAssetKind(mimeType: string | null | undefined): RawAssetKind {
  const normalizedMimeType = (mimeType ?? "").toLowerCase();

  if (normalizedMimeType === "application/pdf") {
    return "PDF";
  }

  if (normalizedMimeType.startsWith("image/")) {
    return "IMAGE";
  }

  if (
    normalizedMimeType === "text/markdown" ||
    normalizedMimeType === "text/x-markdown"
  ) {
    return "MARKDOWN";
  }

  return "TEXT";
}

function getTextValue(formData: FormData): string | null {
  const value = formData.get("text");

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? value : null;
}

function getFileValue(formData: FormData): File | null {
  const value = formData.get("file");

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

async function createAssetFromFile(file: File) {
  const mimeType = file.type || "application/octet-stream";
  const storageKey = buildStorageKey("raw", file.name || "upload.bin");
  const bytes = Buffer.from(await file.arrayBuffer());

  await saveLocalUpload(storageKey, bytes);

  return createRawAsset({
    kind: detectRawAssetKind(mimeType),
    originalName: file.name || "upload.bin",
    mimeType,
    storageKey,
  });
}

async function createAssetFromText(textContent: string) {
  return createRawAsset({
    kind: "TEXT",
    originalName: pastedTextName,
    mimeType: textMimeType,
    textContent,
  });
}

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const formData = await request.formData();
  const file = getFileValue(formData);

  if (file) {
    const rawAsset = await createAssetFromFile(file);

    return NextResponse.json({ rawAsset }, { status: 201 });
  }

  const textContent = getTextValue(formData);

  if (textContent) {
    const rawAsset = await createAssetFromText(textContent);

    return NextResponse.json({ rawAsset }, { status: 201 });
  }

  return NextResponse.json(
    { error: "Provide a non-empty file or text field" },
    { status: 400 },
  );
}
