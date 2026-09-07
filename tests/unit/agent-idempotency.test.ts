import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAgentDrafts } from "@/app/api/agent/question-drafts/route";
import { devAgentScopes } from "@/lib/auth/agent-auth";
import {
  canonicalJson,
  canonicalMultipart,
  hashJsonRequest,
  hashMultipartRequest,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";

const { mockPrisma, mockReadAgentAuth } = vi.hoisted(() => {
  const mockPrisma = {
    $transaction: vi.fn(),
    idempotencyRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    questionDraft: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
    },
    knowledgePoint: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    rawAsset: {
      findUnique: vi.fn(),
    },
  };

  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );

  return {
    mockPrisma,
    mockReadAgentAuth: vi.fn(),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth/agent-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/agent-auth")>();

  return {
    ...actual,
    readAgentAuth: mockReadAgentAuth,
  };
});

function p2002() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

beforeEach(() => {
  mockReadAgentAuth.mockResolvedValue({
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...devAgentScopes],
  });
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: "idem_1" });
  mockPrisma.idempotencyRecord.update.mockResolvedValue({});
  mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
  mockPrisma.questionDraft.create.mockResolvedValue({
    id: "draft_1",
    status: "DRAFT",
    type: null,
    stemMd: "题干",
    optionsJson: null,
    answerJson: null,
    solutionMd: null,
    difficulty: null,
    knowledgePointIds: null,
    tagIds: null,
    sourceRawAssetId: null,
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    promotedAt: null,
  });
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
  mockPrisma.knowledgePoint.findMany.mockResolvedValue([]);
  mockPrisma.tag.findMany.mockResolvedValue([]);
  mockPrisma.rawAsset.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("canonical request hashing", () => {
  it("hashes JSON by method, path, and sorted keys, not pretty-print", () => {
    const compact = { b: 2, a: { d: 4, c: 3 } };
    const reordered = { a: { c: 3, d: 4 }, b: 2 };

    expect(canonicalJson(compact)).toBe(canonicalJson(reordered));
    expect(hashJsonRequest("POST", "/api/agent/question-drafts", compact)).toBe(
      hashJsonRequest("POST", "/api/agent/question-drafts", reordered),
    );
    expect(hashJsonRequest("POST", "/api/agent/question-drafts", compact)).toBe(
      sha256(`POST\n/api/agent/question-drafts\n${canonicalJson(compact)}`),
    );
  });

  it("hashes multipart from file bytes, originalName, and mimeType, not a boundary", () => {
    const bytes = Buffer.from("png-bytes");
    const multipart = {
      file: {
        bytes,
        originalName: "vt.png",
        mimeType: "image/png",
      },
    };
    const expectedCanonical = [
      `fileSha256=${sha256(bytes)}`,
      "originalName=vt.png",
      "mimeType=image/png",
    ].join("\n");

    expect(canonicalMultipart(multipart)).toBe(expectedCanonical);
    expect(canonicalMultipart(multipart)).not.toContain("boundary");
    expect(hashMultipartRequest("POST", "/api/agent/raw-assets", multipart)).toBe(
      sha256(`POST\n/api/agent/raw-assets\n${expectedCanonical}`),
    );
  });
});

describe("withJsonIdempotency", () => {
  it("inserts in_progress first and completes in the same transaction as the write", async () => {
    const execute = vi.fn(async () => ({
      status: 201,
      body: { ok: true },
    }));

    await withJsonIdempotency({
      apiKeyId: "dev-agent",
      key: "k1",
      method: "POST",
      path: "/api/agent/question-drafts",
      body: { stemMd: "题干" },
      execute,
    });

    expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKeyId: "dev-agent",
        key: "k1",
        state: "in_progress",
      }),
    });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(mockPrisma.idempotencyRecord.update).toHaveBeenCalledWith({
      where: { id: "idem_1" },
      data: expect.objectContaining({
        state: "completed",
        responseStatus: 201,
        responseBody: { ok: true },
      }),
    });
  });

  it("replays a completed record with the same hash and does not re-execute", async () => {
    const body = { stemMd: "题干" };
    const requestHash = hashJsonRequest(
      "POST",
      "/api/agent/question-drafts",
      body,
    );
    mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002());
    mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
      id: "idem_1",
      apiKeyId: "dev-agent",
      key: "k1",
      requestHash,
      state: "completed",
      responseStatus: 201,
      responseBody: { request_id: "req-1", draft: { id: "draft_1" } },
      createdAt: new Date(),
    });
    const execute = vi.fn();

    const result = await withJsonIdempotency({
      apiKeyId: "dev-agent",
      key: "k1",
      method: "POST",
      path: "/api/agent/question-drafts",
      body,
      execute,
    });

    expect(result).toEqual({
      status: 201,
      body: { request_id: "req-1", draft: { id: "draft_1" } },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns 409 when a completed key is reused with a different body", async () => {
    mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002());
    mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
      id: "idem_1",
      apiKeyId: "dev-agent",
      key: "k1",
      requestHash: "different-hash",
      state: "completed",
      responseStatus: 201,
      responseBody: { draft: { id: "draft_1" } },
      createdAt: new Date(),
    });

    await expect(
      withJsonIdempotency({
        apiKeyId: "dev-agent",
        key: "k1",
        method: "POST",
        path: "/api/agent/question-drafts",
        body: { stemMd: "other" },
        execute: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message: "Idempotency-Key reused with a different request body",
      status: 409,
    });
  });

  it("deletes the in_progress row when the business write fails", async () => {
    const failure = Object.assign(new Error("Raw asset not found"), {
      name: "DraftRelationError",
    });

    await expect(
      withJsonIdempotency({
        apiKeyId: "dev-agent",
        key: "k1",
        method: "POST",
        path: "/api/agent/question-drafts",
        body: { sourceRawAssetId: "missing" },
        execute: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: "idem_1", state: "in_progress" },
    });
    expect(mockPrisma.idempotencyRecord.update).not.toHaveBeenCalled();
  });

  it("reclaims an in_progress row older than 2 minutes", async () => {
    mockPrisma.idempotencyRecord.create
      .mockRejectedValueOnce(p2002())
      .mockResolvedValueOnce({ id: "idem_2" });
    mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
      id: "idem_1",
      apiKeyId: "dev-agent",
      key: "k1",
      requestHash: "old",
      state: "in_progress",
      responseStatus: null,
      responseBody: null,
      createdAt: new Date(Date.now() - 3 * 60 * 1000),
    });
    mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });

    const execute = vi.fn(async () => ({ status: 201, body: { ok: true } }));

    await withJsonIdempotency({
      apiKeyId: "dev-agent",
      key: "k1",
      method: "POST",
      path: "/api/agent/question-drafts",
      body: { stemMd: "题干" },
      execute,
    });

    expect(mockPrisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        apiKeyId: "dev-agent",
        key: "k1",
        state: "in_progress",
      }),
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledTimes(2);
  });
});

describe("POST /api/agent/question-drafts idempotency", () => {
  function postDraft(key: string, body: unknown) {
    return postAgentDrafts(
      new Request("http://localhost/api/agent/question-drafts", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
          "Idempotency-Key": key,
          "X-Request-Id": "req-1",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  it("requires an Idempotency-Key on mutating agent draft routes", async () => {
    const response = await postAgentDrafts(
      new Request("http://localhost/api/agent/question-drafts", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({ stemMd: "题干" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Idempotency-Key is required",
    });
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
  });

  it("returns 400 Invalid Idempotency-Key for illegal key characters", async () => {
    const response = await postAgentDrafts(
      new Request("http://localhost/api/agent/question-drafts", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "content-type": "application/json",
          "Idempotency-Key": "not a valid key",
        },
        body: JSON.stringify({ stemMd: "题干" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid Idempotency-Key",
    });
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
  });

  it("replays the stored 201 for the same key and body without a second AgentRun", async () => {
    const body = { stemMd: "题干" };
    const first = await postDraft("same-key", body);
    expect(first.status).toBe(201);
    const firstJson = await first.json();

    mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002());
    mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
      id: "idem_1",
      apiKeyId: "dev-agent",
      key: "same-key",
      requestHash: mockPrisma.idempotencyRecord.create.mock.calls[0][0].data
        .requestHash,
      state: "completed",
      responseStatus: 201,
      responseBody: firstJson,
      createdAt: new Date(),
    });
    mockPrisma.questionDraft.create.mockClear();
    mockPrisma.agentRun.create.mockClear();

    const second = await postDraft("same-key", body);

    expect(second.status).toBe(201);
    await expect(second.json()).resolves.toEqual(firstJson);
    expect(mockPrisma.questionDraft.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
  });

  it("uses the dev-agent sentinel when apiKeyId is null", async () => {
    await postDraft("dev-key", { stemMd: "题干" });

    expect(mockPrisma.idempotencyRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKeyId: "dev-agent",
        key: "dev-key",
      }),
    });
  });
});
