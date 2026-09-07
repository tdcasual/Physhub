import { createHash, randomBytes } from "node:crypto";

import { devAgentScopes } from "@/lib/auth/agent-auth";

export const HIGH_RISK_API_KEY_SCOPES = [
  "questions:publish",
  "delete",
  "metadata:write",
] as const;

export type HighRiskApiKeyScope = (typeof HIGH_RISK_API_KEY_SCOPES)[number];

export function createApiKeyPlaintext(): string {
  return `phk_${randomBytes(32).toString("hex")}`;
}

export function hashApiKeyPlaintext(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isHighRiskApiKeyScope(scope: string): scope is HighRiskApiKeyScope {
  return (HIGH_RISK_API_KEY_SCOPES as readonly string[]).includes(scope);
}

export function resolveCreatedApiKeyScopes(options: {
  scopes?: string[];
  allowHighRisk: boolean;
}): string[] {
  const scopes = options.scopes ?? [...devAgentScopes];
  const blocked = scopes.filter(isHighRiskApiKeyScope);

  if (blocked.length > 0 && !options.allowHighRisk) {
    throw new Error(
      `Refusing high-risk scopes without --i-understand-high-risk: ${blocked.join(", ")}`,
    );
  }

  return scopes;
}
