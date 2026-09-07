import { createHash } from "node:crypto";

import { timingSafeEqualString } from "@/lib/auth/secure-compare";

export const devAgentScopes = [
  "questions:read",
  "questions:search",
  "drafts:create",
  "drafts:update",
  "drafts:read",
  "suggestions:create",
  "quality:check",
  "question_sets:create",
  "exports:create",
] as const;

export type AgentAuth = {
  apiKeyId: string | null;
  name: string;
  scopes: string[];
};

const bearerPrefix = "Bearer ";

export function hasRequiredScopes(
  granted: string[],
  required: string[],
): boolean {
  const grantedScopes = new Set(granted);

  return required.every((scope) => grantedScopes.has(scope));
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith(bearerPrefix)) {
    return null;
  }

  const token = authorization.slice(bearerPrefix.length);

  return token.length > 0 ? token : null;
}

function hashApiKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readDevAgentScopes(request: Request): string[] | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const configuredToken = process.env.AGENT_API_KEY_DEV;
  const token = readBearerToken(request);

  if (!configuredToken || !token) {
    return null;
  }

  if (!timingSafeEqualString(token, configuredToken)) {
    return null;
  }

  return [...devAgentScopes];
}

async function lookupApiKey(token: string): Promise<AgentAuth | null> {
  const keyHash = hashApiKey(token);

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

    if (!apiKey || apiKey.revokedAt != null) {
      return null;
    }

    if (!timingSafeEqualString(apiKey.keyHash, keyHash)) {
      return null;
    }

    try {
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Authentication still succeeds if lastUsedAt cannot be written.
    }

    return {
      apiKeyId: apiKey.id,
      name: apiKey.name,
      scopes: apiKey.scopes,
    };
  } catch {
    return null;
  }
}

export async function readAgentAuth(
  request: Request,
): Promise<AgentAuth | null> {
  const token = readBearerToken(request);

  if (!token) {
    return null;
  }

  const configuredToken = process.env.AGENT_API_KEY_DEV;

  if (process.env.NODE_ENV !== "production" && configuredToken) {
    if (timingSafeEqualString(token, configuredToken)) {
      return {
        apiKeyId: null,
        name: "dev-agent",
        scopes: [...devAgentScopes],
      };
    }
  }

  return lookupApiKey(token);
}
