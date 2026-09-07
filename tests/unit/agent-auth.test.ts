import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockApiKeyFindUnique, mockApiKeyUpdate } = vi.hoisted(() => ({
  mockApiKeyFindUnique: vi.fn(),
  mockApiKeyUpdate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: mockApiKeyFindUnique,
      update: mockApiKeyUpdate,
    },
  },
}));

import {
  hasRequiredScopes,
  readAgentAuth,
  readDevAgentScopes,
} from "@/lib/auth/agent-auth";
import { computeEditorSessionCookieValue } from "@/lib/auth/human-auth";

const originalDevKey = process.env.AGENT_API_KEY_DEV;
const originalEditorSecret = process.env.EDITOR_SESSION_SECRET;

const expectedDevScopes = [
  "questions:read",
  "questions:search",
  "drafts:create",
  "drafts:update",
  "drafts:read",
  "suggestions:create",
  "quality:check",
  "question_sets:create",
  "exports:create",
];

beforeEach(() => {
  mockApiKeyFindUnique.mockReset();
  mockApiKeyUpdate.mockReset();
});

afterEach(() => {
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  process.env.EDITOR_SESSION_SECRET = originalEditorSecret;
  vi.unstubAllEnvs();
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

    expect(scopes).toEqual(expectedDevScopes);
    expect(scopes).toContain("drafts:update");
    expect(scopes).toContain("drafts:read");
    expect(scopes).not.toContain("questions:publish");
    expect(scopes).not.toContain("questions:delete");
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

describe("readAgentAuth", () => {
  it("returns the conservative dev-agent identity for a matching bearer token", async () => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";

    await expect(
      readAgentAuth(
        new Request("http://localhost/api/agent/search-questions", {
          headers: { Authorization: "Bearer dev-agent-key" },
        }),
      ),
    ).resolves.toEqual({
      apiKeyId: null,
      name: "dev-agent",
      scopes: expectedDevScopes,
    });
    expect(mockApiKeyFindUnique).not.toHaveBeenCalled();
  });

  it("does not treat an editor session cookie as agent auth", async () => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";
    process.env.EDITOR_SESSION_SECRET = "test-editor-session-secret";

    await expect(
      readAgentAuth(
        new Request("http://localhost/api/agent/search-questions", {
          headers: {
            Cookie: `physhub_editor=${computeEditorSessionCookieValue(
              "test-editor-session-secret",
            )}`,
          },
        }),
      ),
    ).resolves.toBeNull();
  });

  it("ignores AGENT_API_KEY_DEV in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";
    mockApiKeyFindUnique.mockResolvedValue(null);

    await expect(
      readAgentAuth(
        new Request("http://localhost/api/agent/search-questions", {
          headers: { Authorization: "Bearer dev-agent-key" },
        }),
      ),
    ).resolves.toBeNull();
    expect(mockApiKeyFindUnique).toHaveBeenCalled();
  });

  it("looks up a stored api key by sha256 hash", async () => {
    delete process.env.AGENT_API_KEY_DEV;
    const token = "phk_stored-key";
    const keyHash = createHash("sha256").update(token, "utf8").digest("hex");
    mockApiKeyFindUnique.mockResolvedValue({
      id: "api_key_1",
      name: "harness",
      keyHash,
      scopes: ["questions:read"],
      revokedAt: null,
    });
    mockApiKeyUpdate.mockResolvedValue({});

    await expect(
      readAgentAuth(
        new Request("http://localhost/api/agent/questions/question_1", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    ).resolves.toEqual({
      apiKeyId: "api_key_1",
      name: "harness",
      scopes: ["questions:read"],
    });
    expect(mockApiKeyFindUnique).toHaveBeenCalledWith({ where: { keyHash } });
  });

  it("returns null for a revoked api key", async () => {
    delete process.env.AGENT_API_KEY_DEV;
    const token = "phk_revoked";
    const keyHash = createHash("sha256").update(token, "utf8").digest("hex");
    mockApiKeyFindUnique.mockResolvedValue({
      id: "api_key_1",
      name: "harness",
      keyHash,
      scopes: ["questions:read"],
      revokedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(
      readAgentAuth(
        new Request("http://localhost/api/agent/questions/question_1", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    ).resolves.toBeNull();
    expect(mockApiKeyUpdate).not.toHaveBeenCalled();
  });
});
