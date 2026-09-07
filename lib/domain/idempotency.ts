import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const REQUEST_ID_HEADER = "X-Request-Id";
export const DEV_AGENT_IDEMPOTENCY_API_KEY_ID = "dev-agent";
export const IDEMPOTENCY_IN_PROGRESS_TTL_MS = 2 * 60 * 1000;
export const IDEMPOTENCY_POLL_INTERVAL_MS = 50;
export const IDEMPOTENCY_POLL_ATTEMPTS = 20;

export class IdempotencyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "IdempotencyError";
    this.status = status;
  }
}

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;
export type IdempotencyTransactionClient = Omit<
  PrismaClientSingleton,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type IdempotencyExecuteResult = {
  status: number;
  body: unknown;
};

type IdempotencyRecordRow = {
  id: string;
  apiKeyId: string;
  key: string;
  requestHash: string;
  state: string;
  responseStatus: number | null;
  responseBody: Prisma.JsonValue | null;
  createdAt: Date;
};

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [
          key,
          sortKeys((value as Record<string, unknown>)[key]),
        ]),
    );
  }

  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function hashJsonRequest(
  method: string,
  path: string,
  body: unknown,
): string {
  return sha256Hex(`${method}\n${path}\n${canonicalJson(body)}`);
}

export type CanonicalMultipartInput = {
  file?: {
    bytes: Buffer;
    originalName: string;
    mimeType: string;
  };
  text?: string;
  fields?: Record<string, string>;
};

export function canonicalMultipart(input: CanonicalMultipartInput): string {
  const parts: string[] = [];

  if (input.file) {
    parts.push(`fileSha256=${sha256Hex(input.file.bytes)}`);
    parts.push(`originalName=${input.file.originalName}`);
    parts.push(`mimeType=${input.file.mimeType}`);
  }

  if (input.text !== undefined) {
    parts.push(`textSha256=${sha256Hex(input.text)}`);
  }

  if (input.fields) {
    for (const key of Object.keys(input.fields).sort()) {
      parts.push(`${key}=${input.fields[key]}`);
    }
  }

  return parts.join("\n");
}

export function hashMultipartRequest(
  method: string,
  path: string,
  input: CanonicalMultipartInput,
): string {
  return sha256Hex(`${method}\n${path}\n${canonicalMultipart(input)}`);
}

export function parseIdempotencyKey(request: Request): string {
  const header = request.headers.get(IDEMPOTENCY_KEY_HEADER);

  if (header == null || header.trim() === "") {
    throw new IdempotencyError("Idempotency-Key is required", 400);
  }

  const key = header.trim();

  if (key.length > 128 || !/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new IdempotencyError("Invalid Idempotency-Key", 400);
  }

  return key;
}

export function readRequestId(request: Request): string {
  const header = request.headers.get(REQUEST_ID_HEADER)?.trim();

  return header && header.length > 0 ? header : crypto.randomUUID();
}

export function idempotencyApiKeyId(apiKeyId: string | null): string {
  return apiKeyId ?? DEV_AGENT_IDEMPOTENCY_API_KEY_ID;
}

async function getDb(): Promise<PrismaClientSingleton> {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readRecord(
  db: PrismaClientSingleton,
  apiKeyId: string,
  key: string,
): Promise<IdempotencyRecordRow | null> {
  return db.idempotencyRecord.findFirst({
    where: { apiKeyId, key },
  });
}

function replayCompleted(
  record: IdempotencyRecordRow,
  requestHash: string,
): IdempotencyExecuteResult {
  if (record.requestHash !== requestHash) {
    throw new IdempotencyError(
      "Idempotency-Key reused with a different request body",
      409,
    );
  }

  if (record.responseStatus == null) {
    throw new IdempotencyError("Idempotency-Key in progress", 409);
  }

  return {
    status: record.responseStatus,
    body: record.responseBody,
  };
}

async function reclaimStaleInProgress(
  db: PrismaClientSingleton,
  apiKeyId: string,
  key: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_IN_PROGRESS_TTL_MS);
  const deleted = await db.idempotencyRecord.deleteMany({
    where: {
      apiKeyId,
      key,
      state: "in_progress",
      createdAt: { lt: cutoff },
    },
  });

  return deleted.count > 0;
}

async function waitForInProgress(
  db: PrismaClientSingleton,
  apiKeyId: string,
  key: string,
  requestHash: string,
): Promise<IdempotencyExecuteResult | "retry"> {
  for (let attempt = 0; attempt < IDEMPOTENCY_POLL_ATTEMPTS; attempt += 1) {
    await sleep(IDEMPOTENCY_POLL_INTERVAL_MS);
    const current = await readRecord(db, apiKeyId, key);

    if (!current) {
      return "retry";
    }

    if (current.state === "completed") {
      return replayCompleted(current, requestHash);
    }
  }

  throw new IdempotencyError("Idempotency-Key in progress", 409);
}

async function handleExistingRecord(
  db: PrismaClientSingleton,
  existing: IdempotencyRecordRow,
  requestHash: string,
): Promise<IdempotencyExecuteResult | "retry"> {
  if (existing.state === "completed") {
    return replayCompleted(existing, requestHash);
  }

  const ageMs = Date.now() - existing.createdAt.getTime();

  if (ageMs > IDEMPOTENCY_IN_PROGRESS_TTL_MS) {
    const reclaimed = await reclaimStaleInProgress(
      db,
      existing.apiKeyId,
      existing.key,
    );

    if (reclaimed) {
      return "retry";
    }

    const current = await readRecord(db, existing.apiKeyId, existing.key);

    if (!current) {
      return "retry";
    }

    if (current.state === "completed") {
      return replayCompleted(current, requestHash);
    }

    throw new IdempotencyError("Idempotency-Key in progress", 409);
  }

  return waitForInProgress(db, existing.apiKeyId, existing.key, requestHash);
}

export async function withIdempotency(options: {
  apiKeyId: string;
  key: string;
  method: string;
  path: string;
  requestHash: string;
  execute: (
    tx: IdempotencyTransactionClient,
  ) => Promise<IdempotencyExecuteResult>;
}): Promise<IdempotencyExecuteResult> {
  const db = await getDb();
  const requestHash = options.requestHash;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const placeholder = await db.idempotencyRecord.create({
        data: {
          apiKeyId: options.apiKeyId,
          key: options.key,
          method: options.method,
          path: options.path,
          requestHash,
          state: "in_progress",
        },
      });

      try {
        return await db.$transaction(async (tx) => {
          const executed = await options.execute(tx);
          await tx.idempotencyRecord.update({
            where: { id: placeholder.id },
            data: {
              state: "completed",
              responseStatus: executed.status,
              responseBody:
                executed.body === undefined
                  ? undefined
                  : (executed.body as Prisma.InputJsonValue),
            },
          });

          return executed;
        });
      } catch (error) {
        await db.idempotencyRecord.deleteMany({
          where: { id: placeholder.id, state: "in_progress" },
        });
        throw error;
      }
    } catch (error) {
      if (!isUniqueConflict(error)) {
        throw error;
      }

      const existing = await readRecord(db, options.apiKeyId, options.key);

      if (!existing) {
        continue;
      }

      const handled = await handleExistingRecord(db, existing, requestHash);

      if (handled === "retry") {
        continue;
      }

      return handled;
    }
  }

  throw new IdempotencyError("Idempotency-Key in progress", 409);
}

export async function withJsonIdempotency(options: {
  apiKeyId: string;
  key: string;
  method: string;
  path: string;
  body: unknown;
  execute: (
    tx: IdempotencyTransactionClient,
  ) => Promise<IdempotencyExecuteResult>;
}): Promise<IdempotencyExecuteResult> {
  return withIdempotency({
    apiKeyId: options.apiKeyId,
    key: options.key,
    method: options.method,
    path: options.path,
    requestHash: hashJsonRequest(options.method, options.path, options.body),
    execute: options.execute,
  });
}

export async function withMultipartIdempotency(options: {
  apiKeyId: string;
  key: string;
  method: string;
  path: string;
  multipart: CanonicalMultipartInput;
  execute: (
    tx: IdempotencyTransactionClient,
  ) => Promise<IdempotencyExecuteResult>;
}): Promise<IdempotencyExecuteResult> {
  return withIdempotency({
    apiKeyId: options.apiKeyId,
    key: options.key,
    method: options.method,
    path: options.path,
    requestHash: hashMultipartRequest(
      options.method,
      options.path,
      options.multipart,
    ),
    execute: options.execute,
  });
}
