import { describe, expect, it, vi } from "vitest";

import { devAgentScopes } from "@/lib/auth/agent-auth";
import {
  apiKeyPrefixFromPlaintext,
  createApiKeyPlaintext,
  hashApiKeyPlaintext,
  isUsableApiKeyName,
  resolveCreatedApiKeyScopes,
} from "@/lib/auth/api-key-policy";
import { createApiKeyRecord } from "@/scripts/create-api-key";

describe("create-api-key policy", () => {
  it("prints phk_ plus 64 hex characters and stores the sha256 hex", () => {
    const token = createApiKeyPlaintext();

    expect(token).toMatch(/^phk_[0-9a-f]{64}$/);
    expect(hashApiKeyPlaintext(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKeyPlaintext(token)).toHaveLength(64);
    expect(apiKeyPrefixFromPlaintext(token)).toBe(token.slice(0, 12));
    expect(isUsableApiKeyName("高一备课")).toBe(true);
    expect(isUsableApiKeyName(" ")).toBe(false);
  });

  it("defaults to conservative agent scopes and refuses high-risk scopes without the flag", () => {
    expect(resolveCreatedApiKeyScopes({ allowHighRisk: false })).toEqual([
      ...devAgentScopes,
    ]);
    expect(resolveCreatedApiKeyScopes({ allowHighRisk: false })).toContain(
      "questions:publish",
    );
    expect(resolveCreatedApiKeyScopes({ allowHighRisk: false })).not.toEqual(
      expect.arrayContaining(["delete", "metadata:write"]),
    );

    expect(
      resolveCreatedApiKeyScopes({
        scopes: ["drafts:create", "questions:publish"],
        allowHighRisk: false,
      }),
    ).toEqual(["drafts:create", "questions:publish"]);

    expect(() =>
      resolveCreatedApiKeyScopes({
        scopes: ["drafts:create", "delete"],
        allowHighRisk: false,
      }),
    ).toThrow(/--i-understand-high-risk/);
  });

  it("persists hashed key through the script entry helper", async () => {
    const persist = vi.fn().mockResolvedValue({});
    const result = await createApiKeyRecord({
      name: "test",
      allowHighRisk: false,
      extraScopes: [],
      persist,
    });

    expect(result.token).toMatch(/^phk_[0-9a-f]{64}$/);
    expect(persist).toHaveBeenCalledWith({
      name: "test",
      keyHash: hashApiKeyPlaintext(result.token),
      keyPrefix: result.token.slice(0, 12),
      keyCiphertext: expect.stringMatching(/^v1\$/),
      scopes: [...devAgentScopes],
    });
  });
});
