export const devAgentScopes = [
  "questions:read",
  "questions:search",
  "drafts:create",
  "suggestions:create",
  "quality:check",
  "question_sets:create",
  "exports:create",
] as const;

export function hasRequiredScopes(
  granted: string[],
  required: string[],
): boolean {
  const grantedScopes = new Set(granted);

  return required.every((scope) => grantedScopes.has(scope));
}

export function readDevAgentScopes(request: Request): string[] | null {
  const configuredToken = process.env.AGENT_API_KEY_DEV;

  if (!configuredToken) {
    return null;
  }

  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";

  if (!authorization?.startsWith(bearerPrefix)) {
    return null;
  }

  const token = authorization.slice(bearerPrefix.length);

  if (token !== configuredToken) {
    return null;
  }

  return [...devAgentScopes];
}
