import { afterEach, describe, expect, it } from "vitest";

import { hasRequiredScopes, readDevAgentScopes } from "@/lib/auth/agent-auth";

const originalDevKey = process.env.AGENT_API_KEY_DEV;

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
});

describe("hasRequiredScopes", () => {
  it("returns true when every required scope is granted", () => {
    expect(
      hasRequiredScopes(
        ["questions:read", "questions:search", "drafts:create"],
        ["questions:search", "questions:read"],
      ),
    ).toBe(true);
  });

  it("returns false when any required scope is missing", () => {
    expect(
      hasRequiredScopes(
        ["questions:read", "drafts:create"],
        ["questions:read", "questions:search"],
      ),
    ).toBe(false);
  });

  it("treats no required scopes as satisfied", () => {
    expect(hasRequiredScopes([], [])).toBe(true);
  });
});

describe("readDevAgentScopes", () => {
  it("returns the conservative dev agent scopes for a matching bearer token", () => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";

    const scopes = readDevAgentScopes(
      new Request("http://localhost/api/agent/search-questions", {
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
    );

    expect(scopes).toEqual([
      "questions:read",
      "questions:search",
      "drafts:create",
      "suggestions:create",
      "quality:check",
      "question_sets:create",
      "exports:create",
    ]);
    expect(scopes).not.toContain("publish");
    expect(scopes).not.toContain("delete");
    expect(scopes).not.toContain("metadata:write");
  });

  it("returns null for missing, malformed, or nonmatching authorization", () => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";

    expect(
      readDevAgentScopes(
        new Request("http://localhost/api/agent/search-questions"),
      ),
    ).toBeNull();
    expect(
      readDevAgentScopes(
        new Request("http://localhost/api/agent/search-questions", {
          headers: { Authorization: "Basic dev-agent-key" },
        }),
      ),
    ).toBeNull();
    expect(
      readDevAgentScopes(
        new Request("http://localhost/api/agent/search-questions", {
          headers: { Authorization: "Bearer wrong-token" },
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the dev key is not configured", () => {
    delete process.env.AGENT_API_KEY_DEV;

    expect(
      readDevAgentScopes(
        new Request("http://localhost/api/agent/search-questions", {
          headers: { Authorization: "Bearer dev-agent-key" },
        }),
      ),
    ).toBeNull();
  });
});
