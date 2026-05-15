import type { Prisma, RawAssetKind } from "@prisma/client";

export type CreateRawAssetInput = {
  kind: RawAssetKind;
  originalName: string;
  mimeType?: string | null;
  storageKey?: string | null;
  textContent?: string | null;
};

type PrismaClientSingleton = typeof import("@/lib/db/prisma").prisma;

async function getDb(): Promise<PrismaClientSingleton> {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

export type RawAssetRecord = Prisma.RawAssetGetPayload<Record<string, never>>;

export async function createRawAsset(
  input: CreateRawAssetInput,
): Promise<RawAssetRecord> {
  const db = await getDb();

  return db.rawAsset.create({
    data: {
      kind: input.kind,
      originalName: input.originalName,
      mimeType: input.mimeType ?? null,
      storageKey: input.storageKey ?? null,
      textContent: input.textContent ?? null,
    },
  });
}
