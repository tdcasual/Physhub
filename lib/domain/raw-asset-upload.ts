import type { RawAssetKind } from "@prisma/client";

import type { CanonicalMultipartInput } from "@/lib/domain/idempotency";
import {
  createRawAsset,
  type CreateRawAssetInput,
  type RawAssetRecord,
} from "@/lib/domain/raw-asset-repository";
import {
  buildStorageKey,
  removeLocalUpload,
  saveLocalUpload,
} from "@/lib/storage/storage-service";

export const PASTED_TEXT_NAME = "pasted-text.txt";
export const PASTED_TEXT_MIME_TYPE = "text/plain";
export const PASTED_TEXT_MAX_CHARS = 100_000;

export const RAW_ASSET_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
]);

export const RAW_ASSET_MAX_BYTES: Record<RawAssetKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  PDF: 20 * 1024 * 1024,
  MARKDOWN: 1 * 1024 * 1024,
  TEXT: 1 * 1024 * 1024,
  LATEX: 1 * 1024 * 1024,
};

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
type TransactionClient = Omit<
  PrismaClientSingleton,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
export type RawAssetDbClient = PrismaClientSingleton | TransactionClient;

export class RawAssetUploadError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "RawAssetUploadError";
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

export function assertSniffedKind(mimeType: string, bytes: Buffer): void {
  const kind = detectRawAssetKind(mimeType);

  if (kind === "IMAGE") {
    if (
      mimeType === "image/png" &&
      bytes.subarray(0, 4).equals(PNG_SIGNATURE)
    ) {
      return;
    }

    if (
      (mimeType === "image/jpeg" || mimeType === "image/jpg") &&
      bytes.subarray(0, 3).equals(JPEG_SIGNATURE)
    ) {
      return;
    }

    if (
      mimeType === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return;
    }

    throw new RawAssetUploadError("Unsupported media type");
  }

  if (kind === "PDF") {
    if (bytes.subarray(0, 4).toString("ascii") === "%PDF") {
      return;
    }

    throw new RawAssetUploadError("Unsupported media type");
  }

  const head = bytes.subarray(0, 64).toString("latin1");

  if (bytes.includes(0) || /^\s*<svg/i.test(head) || /^\s*<html/i.test(head)) {
    throw new RawAssetUploadError("Unsupported media type");
  }
}

export function asciiFilenameFallback(originalName: string | null | undefined) {
  const stripped = (originalName ?? "")
    .replace(/[\x00-\x1f\x7f"\\]/g, "")
    .trim();
  const ascii = stripped.replace(/[^\x20-\x7e]/g, "");
  return ascii || "download";
}

export function encodeRfc5987AttrValue(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

export function buildContentDisposition(
  originalName: string | null | undefined,
  inline: boolean,
): string {
  const fallback = asciiFilenameFallback(originalName);
  const rawName = (originalName ?? "").replace(/[\x00-\x1f\x7f]/g, "") || fallback;
  const encoded = encodeRfc5987AttrValue(rawName);
  const type = inline ? "inline" : "attachment";
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function isInlineRawAssetMime(mimeType: string | null | undefined) {
  const mime = (mimeType ?? "").toLowerCase();
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

export function detectRawAssetKind(
  mimeType: string | null | undefined,
): RawAssetKind {
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

  return value.trim().length > 0 ? value : null;
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).type === "string"
  );
}

function getFileValue(formData: FormData): File | null {
  const value = formData.get("file");

  if (!value || !isUploadedFile(value) || value.size === 0) {
    return null;
  }

  return value;
}

function extraScalarFields(formData: FormData): Record<string, string> | undefined {
  const fields: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (key === "file" || key === "text") {
      continue;
    }

    if (typeof value === "string") {
      fields[key] = value;
    }
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}

export type ParsedRawAssetUpload =
  | {
      source: "file";
      multipart: CanonicalMultipartInput;
      file: {
        bytes: Buffer;
        originalName: string;
        mimeType: string;
        kind: RawAssetKind;
      };
    }
  | {
      source: "text";
      multipart: CanonicalMultipartInput;
      text: string;
    };

export async function parseRawAssetFormData(
  formData: FormData,
): Promise<ParsedRawAssetUpload> {
  const fields = extraScalarFields(formData);
  const file = getFileValue(formData);

  if (file) {
    const mimeType = file.type;

    if (!mimeType || !RAW_ASSET_ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new RawAssetUploadError("Unsupported media type");
    }

    const normalizedMimeType = mimeType.toLowerCase();
    const kind = detectRawAssetKind(normalizedMimeType);

    if (
      typeof file.size === "number" &&
      file.size > RAW_ASSET_MAX_BYTES[kind]
    ) {
      throw new RawAssetUploadError("File too large");
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.length > RAW_ASSET_MAX_BYTES[kind]) {
      throw new RawAssetUploadError("File too large");
    }

    assertSniffedKind(normalizedMimeType, bytes);

    const originalName = file.name || "upload.bin";

    return {
      source: "file",
      multipart: {
        file: {
          bytes,
          originalName,
          mimeType: normalizedMimeType,
        },
        ...(fields ? { fields } : {}),
      },
      file: {
        bytes,
        originalName,
        mimeType: normalizedMimeType,
        kind,
      },
    };
  }

  const text = getTextValue(formData);

  if (text) {
    if (text.length > PASTED_TEXT_MAX_CHARS) {
      throw new RawAssetUploadError("Text too large");
    }

    return {
      source: "text",
      multipart: {
        text,
        ...(fields ? { fields } : {}),
      },
      text,
    };
  }

  throw new RawAssetUploadError("Provide a non-empty file or text field");
}

export type PreparedRawAsset = {
  input: CreateRawAssetInput;
  bytes?: Buffer;
};

export function prepareParsedRawAsset(
  parsed: ParsedRawAssetUpload,
): PreparedRawAsset {
  if (parsed.source === "file") {
    return {
      input: {
        kind: parsed.file.kind,
        originalName: parsed.file.originalName,
        mimeType: parsed.file.mimeType,
        storageKey: buildStorageKey("raw", parsed.file.originalName),
      },
      bytes: parsed.file.bytes,
    };
  }

  return {
    input: {
      kind: "TEXT",
      originalName: PASTED_TEXT_NAME,
      mimeType: PASTED_TEXT_MIME_TYPE,
      textContent: parsed.text,
    },
  };
}

export async function writePreparedRawAssetFile(
  prepared: PreparedRawAsset,
): Promise<void> {
  if (!prepared.bytes || !prepared.input.storageKey) {
    return;
  }

  await saveLocalUpload(prepared.input.storageKey, prepared.bytes);
}

export async function discardPreparedRawAssetFile(
  prepared: PreparedRawAsset,
): Promise<void> {
  if (!prepared.input.storageKey) {
    return;
  }

  await removeLocalUpload(prepared.input.storageKey).catch(() => undefined);
}

export async function persistParsedRawAsset(
  parsed: ParsedRawAssetUpload,
  db?: RawAssetDbClient,
): Promise<RawAssetRecord> {
  const prepared = prepareParsedRawAsset(parsed);

  if (prepared.bytes && prepared.input.storageKey) {
    await writePreparedRawAssetFile(prepared);

    try {
      return await createRawAsset(prepared.input, db);
    } catch (error) {
      await discardPreparedRawAssetFile(prepared);
      throw error;
    }
  }

  return createRawAsset(prepared.input, db);
}
