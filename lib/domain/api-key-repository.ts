import { devAgentScopes } from "@/lib/auth/agent-auth";
import {
  apiKeyPrefixFromPlaintext,
  hashApiKeyPlaintext,
  isUsableApiKeyName,
} from "@/lib/auth/api-key-policy";
import {
  ApiKeyUnwrapError,
  isApiKeyWrapConfigError,
  unwrapApiKeyPlaintext,
} from "@/lib/auth/api-key-wrap";
import { prisma } from "@/lib/db/prisma";
import { createApiKeyRecord } from "@/scripts/create-api-key";

export const DEV_ENV_API_KEY_ID = "dev-env";

export class ApiKeyAdminError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiKeyAdminError";
    this.status = status;
  }
}

export type ManagedApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdByUsername: string | null;
  copyable: boolean;
  kind: "stored" | "dev-env";
};

type StoredApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  keyCiphertext: string | null;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdBy: { username: string } | null;
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toManagedApiKey(row: StoredApiKeyRow): ManagedApiKey {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    scopes: row.scopes,
    createdAt: toIso(row.createdAt),
    lastUsedAt: toIso(row.lastUsedAt),
    revokedAt: toIso(row.revokedAt),
    createdByUsername: row.createdBy?.username ?? null,
    copyable: Boolean(row.keyCiphertext),
    kind: "stored",
  };
}

function devEnvManagedApiKey(): ManagedApiKey | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const token = process.env.AGENT_API_KEY_DEV;

  if (!token) {
    return null;
  }

  return {
    id: DEV_ENV_API_KEY_ID,
    name: "本地开发密钥",
    prefix: apiKeyPrefixFromPlaintext(token),
    scopes: [...devAgentScopes],
    createdAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdByUsername: null,
    copyable: true,
    kind: "dev-env",
  };
}

const storedSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  keyCiphertext: true,
  scopes: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdBy: {
    select: { username: true },
  },
} as const;

export async function listManagedApiKeys(): Promise<ManagedApiKey[]> {
  const rows = await prisma.apiKey.findMany({
    select: storedSelect,
    orderBy: { createdAt: "desc" },
  });
  const stored = rows.map(toManagedApiKey);
  const dev = devEnvManagedApiKey();

  return dev ? [dev, ...stored] : stored;
}

export async function issueManagedApiKey(options: {
  name: string;
  createdById: string;
}): Promise<{ apiKey: ManagedApiKey; token: string }> {
  const name = options.name.trim();

  if (!isUsableApiKeyName(name)) {
    throw new ApiKeyAdminError(400, "请填写密钥名称（2–64 个字）");
  }

  try {
    const result = await createApiKeyRecord({
      name,
      allowHighRisk: false,
      extraScopes: [],
      persist: (data) =>
        prisma.apiKey.create({
          data: {
            name: data.name,
            keyHash: data.keyHash,
            keyPrefix: data.keyPrefix,
            keyCiphertext: data.keyCiphertext,
            scopes: data.scopes,
            createdById: options.createdById,
          },
          select: storedSelect,
        }),
    });

    return {
      apiKey: toManagedApiKey(result.created),
      token: result.token,
    };
  } catch (error) {
    if (isApiKeyWrapConfigError(error)) {
      throw new ApiKeyAdminError(500, "密钥保险未配置");
    }

    throw error;
  }
}

export async function revealManagedApiKey(id: string): Promise<string> {
  if (id === DEV_ENV_API_KEY_ID) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiKeyAdminError(404, "密钥不存在");
    }

    const token = process.env.AGENT_API_KEY_DEV;

    if (!token) {
      throw new ApiKeyAdminError(404, "密钥不存在");
    }

    return token;
  }

  const row = await prisma.apiKey.findUnique({
    where: { id },
    select: { keyHash: true, keyCiphertext: true },
  });

  if (!row) {
    throw new ApiKeyAdminError(404, "密钥不存在");
  }

  if (!row.keyCiphertext) {
    throw new ApiKeyAdminError(409, "签发时未保存明文，请重新签发");
  }

  try {
    const token = unwrapApiKeyPlaintext(row.keyCiphertext);

    if (hashApiKeyPlaintext(token) !== row.keyHash) {
      throw new ApiKeyAdminError(500, "无法解开密钥");
    }

    return token;
  } catch (error) {
    if (error instanceof ApiKeyAdminError) {
      throw error;
    }

    if (isApiKeyWrapConfigError(error)) {
      throw new ApiKeyAdminError(500, "密钥保险未配置");
    }

    if (error instanceof ApiKeyUnwrapError) {
      throw new ApiKeyAdminError(500, "无法解开密钥");
    }

    throw error;
  }
}

export async function revokeManagedApiKey(id: string): Promise<ManagedApiKey> {
  if (id === DEV_ENV_API_KEY_ID) {
    throw new ApiKeyAdminError(400, "本地开发密钥不能吊销");
  }

  const existing = await prisma.apiKey.findUnique({
    where: { id },
    select: storedSelect,
  });

  if (!existing) {
    throw new ApiKeyAdminError(404, "密钥不存在");
  }

  if (existing.revokedAt) {
    return toManagedApiKey(existing);
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
    select: storedSelect,
  });

  return toManagedApiKey(updated);
}

export function mapApiKeyAdminError(error: unknown): {
  error: string;
  status: number;
} {
  if (error instanceof ApiKeyAdminError) {
    return { error: error.message, status: error.status };
  }

  if (isApiKeyWrapConfigError(error)) {
    return { error: "密钥保险未配置", status: 500 };
  }

  return { error: "无法处理密钥", status: 500 };
}
