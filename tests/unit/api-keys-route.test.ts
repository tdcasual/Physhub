import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashApiKeyPlaintext } from "@/lib/auth/api-key-policy";
import { wrapApiKeyPlaintext } from "@/lib/auth/api-key-wrap";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  apiKeyFindMany: vi.fn(),
  apiKeyFindUnique: vi.fn(),
  apiKeyCreate: vi.fn(),
  apiKeyUpdate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaMocks.userFindUnique,
    },
    editorSession: {
      findUnique: vi.fn(),
    },
    apiKey: {
      findMany: prismaMocks.apiKeyFindMany,
      findUnique: prismaMocks.apiKeyFindUnique,
      create: prismaMocks.apiKeyCreate,
      update: prismaMocks.apiKeyUpdate,
    },
  },
}));

import { GET as listApiKeys, POST as issueApiKey } from "@/app/api/api-keys/route";
import { POST as revealApiKey } from "@/app/api/api-keys/[id]/reveal/route";
import { POST as revokeApiKey } from "@/app/api/api-keys/[id]/revoke/route";

const originalDevKey = process.env.AGENT_API_KEY_DEV;

function ownerRow() {
  return {
    id: "user_owner",
    username: "owner",
    role: "OWNER" as const,
    disabledAt: null,
  };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key_1",
    name: "备课 agent",
    keyPrefix: "phk_abcdef12",
    keyCiphertext: "v1$cipher",
    scopes: ["questions:read"],
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    lastUsedAt: null,
    revokedAt: null,
    createdBy: { username: "tdcasual" },
    ...overrides,
  };
}

describe("api-keys teacher routes", () => {
  beforeEach(() => {
    process.env.AGENT_API_KEY_DEV = "dev-agent-key";
    prismaMocks.userFindUnique.mockReset();
    prismaMocks.apiKeyFindMany.mockReset();
    prismaMocks.apiKeyFindUnique.mockReset();
    prismaMocks.apiKeyCreate.mockReset();
    prismaMocks.apiKeyUpdate.mockReset();
    prismaMocks.userFindUnique.mockResolvedValue(ownerRow());
    prismaMocks.apiKeyFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.AGENT_API_KEY_DEV = originalDevKey;
  });

  it("rejects missing session and agent bearer", async () => {
    const unauth = await listApiKeys(new Request("http://localhost/api/api-keys"));
    expect(unauth.status).toBe(401);

    const agent = await issueApiKey(
      new Request("http://localhost/api/api-keys", {
        method: "POST",
        headers: {
          authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "agent" }),
      }),
    );
    expect(agent.status).toBe(403);
    await expect(agent.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
  });

  it("forbids viewers", async () => {
    prismaMocks.userFindUnique.mockResolvedValue({
      ...ownerRow(),
      role: "VIEWER",
    });

    const response = await listApiKeys(
      editorSessionRequest("http://localhost/api/api-keys"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("lists stored keys plus the local dev key", async () => {
    prismaMocks.apiKeyFindMany.mockResolvedValue([storedRow()]);

    const response = await listApiKeys(
      editorSessionRequest("http://localhost/api/api-keys"),
    );
    const payload = (await response.json()) as {
      apiKeys: Array<{ id: string; copyable: boolean; kind: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.apiKeys[0]).toMatchObject({
      id: "dev-env",
      kind: "dev-env",
      copyable: true,
    });
    expect(payload.apiKeys[1]).toMatchObject({
      id: "key_1",
      kind: "stored",
      copyable: true,
    });
    expect(JSON.stringify(payload)).not.toContain("dev-agent-key");
  });

  it("issues a wrapped key and returns plaintext once", async () => {
    prismaMocks.apiKeyCreate.mockImplementation(async ({ data }) =>
      storedRow({
        name: data.name,
        keyPrefix: data.keyPrefix,
        keyCiphertext: data.keyCiphertext,
        scopes: data.scopes,
        createdBy: { username: "owner" },
      }),
    );

    const response = await issueApiKey(
      editorSessionRequest("http://localhost/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "高一备课" }),
      }),
    );
    const payload = (await response.json()) as {
      token: string;
      apiKey: { name: string; copyable: boolean };
    };

    expect(response.status).toBe(201);
    expect(payload.token).toMatch(/^phk_[0-9a-f]{64}$/);
    expect(payload.apiKey.name).toBe("高一备课");
    expect(payload.apiKey.copyable).toBe(true);
    expect(prismaMocks.apiKeyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "高一备课",
          createdById: "user_owner",
          keyCiphertext: expect.stringMatching(/^v1\$/),
        }),
      }),
    );
  });

  it("rejects a blank name", async () => {
    const response = await issueApiKey(
      editorSessionRequest("http://localhost/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: " " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请填写密钥名称（2–64 个字）",
    });
  });

  it("reveals a wrapped key and the local dev key", async () => {
    const token = `phk_${"ab".repeat(32)}`;
    prismaMocks.apiKeyFindUnique.mockResolvedValue({
      keyHash: hashApiKeyPlaintext(token),
      keyCiphertext: wrapApiKeyPlaintext(token),
    });

    const stored = await revealApiKey(
      editorSessionRequest("http://localhost/api/api-keys/key_1/reveal", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "key_1" }) },
    );
    await expect(stored.json()).resolves.toEqual({ token });

    const dev = await revealApiKey(
      editorSessionRequest("http://localhost/api/api-keys/dev-env/reveal", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dev-env" }) },
    );
    await expect(dev.json()).resolves.toEqual({ token: "dev-agent-key" });
  });

  it("does not reveal a legacy key without ciphertext", async () => {
    prismaMocks.apiKeyFindUnique.mockResolvedValue({
      keyHash: "abc",
      keyCiphertext: null,
    });

    const response = await revealApiKey(
      editorSessionRequest("http://localhost/api/api-keys/key_1/reveal", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "key_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "签发时未保存明文，请重新签发",
    });
  });

  it("revokes a stored key and refuses the local dev key", async () => {
    prismaMocks.apiKeyFindUnique.mockResolvedValue(storedRow());
    prismaMocks.apiKeyUpdate.mockResolvedValue(
      storedRow({ revokedAt: new Date("2026-09-09T01:00:00.000Z") }),
    );

    const revoked = await revokeApiKey(
      editorSessionRequest("http://localhost/api/api-keys/key_1/revoke", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "key_1" }) },
    );
    const payload = (await revoked.json()) as { apiKey: { revokedAt: string } };

    expect(revoked.status).toBe(200);
    expect(payload.apiKey.revokedAt).toBe("2026-09-09T01:00:00.000Z");

    const dev = await revokeApiKey(
      editorSessionRequest("http://localhost/api/api-keys/dev-env/revoke", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "dev-env" }) },
    );
    expect(dev.status).toBe(400);
  });
});
