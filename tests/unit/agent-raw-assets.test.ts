import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postAgentRawAssets } from "@/app/api/agent/raw-assets/route";
import { GET as getAgentRawAssetFile } from "@/app/api/agent/raw-assets/[id]/file/route";
import { devAgentScopes } from "@/lib/auth/agent-auth";
import { RAW_ASSET_MAX_BYTES } from "@/lib/domain/raw-asset-upload";

const { mockPrisma, mockReadAgentAuth, mockSaveLocalUpload, mockReadLocalUpload } =
  vi.hoisted(() => {
    const mockPrisma = {
      $transaction: vi.fn(),
      idempotencyRecord: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      rawAsset: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      agentRun: {
        create: vi.fn(),
      },
      question: {
        create: vi.fn(),
      },
      questionDraft: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
    );

    return {
      mockPrisma,
      mockReadAgentAuth: vi.fn(),
      mockSaveLocalUpload: vi.fn(),
      mockReadLocalUpload: vi.fn(),
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

vi.mock("@/lib/storage/storage-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/storage/storage-service")>();

  return {
    ...actual,
    saveLocalUpload: mockSaveLocalUpload,
    readLocalUpload: mockReadLocalUpload,
  };
});

function p2002() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function agentAuth(scopes: readonly string[] = devAgentScopes) {
  return {
    apiKeyId: null,
    name: "dev-agent",
    scopes: [...scopes],
  };
}

function multipartBody(
  file: { bytes: Buffer; filename: string; mimeType: string },
  boundary: string,
) {
  const header = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${file.filename}"`,
      `Content-Type: ${file.mimeType}`,
      "",
      "",
    ].join("\r\n"),
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return Buffer.concat([header, file.bytes, footer]);
}

function agentMultipartRequest(
  file: { bytes?: Buffer; filename?: string; mimeType?: string } = {},
  init: RequestInit = {},
  boundary = "test-boundary",
) {
  const payload = {
    bytes: file.bytes ?? Buffer.from("png-bytes"),
    filename: file.filename ?? "vt.png",
    mimeType: file.mimeType ?? "image/png",
  };

  return new Request("http://localhost/api/agent/raw-assets", {
    method: "POST",
    ...init,
    headers: {
      Authorization: "Bearer dev-agent-key",
      "Idempotency-Key": "raw-key-1",
      "X-Request-Id": "req-1",
      "content-type": `multipart/form-data; boundary=${boundary}`,
      ...init.headers,
    },
    body: new Uint8Array(multipartBody(payload, boundary)),
  });
}

function rawAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "raw_1",
    kind: "IMAGE",
    status: "UPLOADED",
    originalName: "vt.png",
    mimeType: "image/png",
    storageKey: "raw/vt.png",
    textContent: null,
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    updatedAt: new Date("2026-09-07T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockReadAgentAuth.mockResolvedValue(agentAuth());
  mockPrisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma),
  );
  mockPrisma.idempotencyRecord.create.mockResolvedValue({ id: "idem_1" });
  mockPrisma.idempotencyRecord.update.mockResolvedValue({});
  mockPrisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 1 });
  mockPrisma.idempotencyRecord.findFirst.mockResolvedValue(null);
  mockPrisma.rawAsset.create.mockResolvedValue(rawAssetRow());
  mockPrisma.rawAsset.findUnique.mockResolvedValue(null);
  mockPrisma.agentRun.create.mockResolvedValue({ id: "run_1" });
  mockSaveLocalUpload.mockResolvedValue("/tmp/uploads/raw/vt.png");
  mockReadLocalUpload.mockResolvedValue(Buffer.from("png-bytes"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/agent/raw-assets", () => {
  it("returns 401 without a drafts:create bearer token", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await postAgentRawAssets(
      new Request("http://localhost/api/agent/raw-assets", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=test-boundary",
        },
        body: new Uint8Array(
          multipartBody(
            {
              bytes: Buffer.from("png-bytes"),
              filename: "vt.png",
              mimeType: "image/png",
            },
            "test-boundary",
          ),
        ),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
  });

  it("returns 401 when drafts:create is missing from the key", async () => {
    mockReadAgentAuth.mockResolvedValue(
      agentAuth(devAgentScopes.filter((scope) => scope !== "drafts:create")),
    );

    const response = await postAgentRawAssets(agentMultipartRequest());

    expect(response.status).toBe(401);
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
  });

  it("requires an Idempotency-Key", async () => {
    const response = await postAgentRawAssets(
      new Request("http://localhost/api/agent/raw-assets", {
        method: "POST",
        headers: {
          Authorization: "Bearer dev-agent-key",
          "X-Request-Id": "req-1",
          "content-type": "multipart/form-data; boundary=test-boundary",
        },
        body: new Uint8Array(
          multipartBody(
            {
              bytes: Buffer.from("png-bytes"),
              filename: "vt.png",
              mimeType: "image/png",
            },
            "test-boundary",
          ),
        ),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Idempotency-Key is required",
      request_id: "req-1",
    });
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
  });

  it("creates a raw asset with request_id", async () => {
    const response = await postAgentRawAssets(agentMultipartRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request_id: "req-1",
      rawAsset: {
        id: "raw_1",
        kind: "IMAGE",
        status: "UPLOADED",
        originalName: "vt.png",
        mimeType: "image/png",
      },
    });
    expect(mockSaveLocalUpload).toHaveBeenCalled();
    expect(mockPrisma.rawAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "IMAGE",
        originalName: "vt.png",
        mimeType: "image/png",
      }),
    });
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolName: "create_raw_asset",
        agentName: "dev-agent",
      }),
    });
  });

  it("rejects svg uploads", async () => {
    const response = await postAgentRawAssets(
      agentMultipartRequest({
        bytes: Buffer.from("<svg></svg>"),
        filename: "icon.svg",
        mimeType: "image/svg+xml",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unsupported media type",
    });
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
  });

  it("rejects a PNG larger than 10MiB", async () => {
    const response = await postAgentRawAssets(
      agentMultipartRequest({
        bytes: Buffer.alloc(RAW_ASSET_MAX_BYTES.IMAGE + 1),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "File too large",
    });
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
  });

  it("replays the same file with a different multipart boundary", async () => {
    const bytes = Buffer.from("png-bytes");
    const first = await postAgentRawAssets(
      agentMultipartRequest({ bytes }, {}, "boundary-one"),
    );
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    const requestHash =
      mockPrisma.idempotencyRecord.create.mock.calls[0][0].data.requestHash;

    mockPrisma.idempotencyRecord.create.mockRejectedValue(p2002());
    mockPrisma.idempotencyRecord.findFirst.mockResolvedValue({
      id: "idem_1",
      apiKeyId: "dev-agent",
      key: "raw-key-1",
      requestHash,
      state: "completed",
      responseStatus: 201,
      responseBody: firstJson,
      createdAt: new Date(),
    });
    mockPrisma.rawAsset.create.mockClear();
    mockPrisma.agentRun.create.mockClear();
    mockSaveLocalUpload.mockClear();

    const second = await postAgentRawAssets(
      agentMultipartRequest({ bytes }, {}, "boundary-two"),
    );

    expect(second.status).toBe(201);
    await expect(second.json()).resolves.toEqual(firstJson);
    expect(mockPrisma.rawAsset.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
    expect(mockSaveLocalUpload).not.toHaveBeenCalled();
  });
});

describe("GET /api/agent/raw-assets/:id/file", () => {
  function fileRequest(id: string, init: RequestInit = {}) {
    return new Request(`http://localhost/api/agent/raw-assets/${id}/file`, {
      ...init,
      headers: {
        Authorization: "Bearer dev-agent-key",
        ...init.headers,
      },
    });
  }

  it("returns 401 without agent auth", async () => {
    mockReadAgentAuth.mockResolvedValue(null);

    const response = await getAgentRawAssetFile(
      new Request("http://localhost/api/agent/raw-assets/raw_1/file"),
      { params: Promise.resolve({ id: "raw_1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockPrisma.rawAsset.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the path id is missing", async () => {
    mockPrisma.rawAsset.findUnique.mockResolvedValue(null);

    const response = await getAgentRawAssetFile(fileRequest("missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
  });

  it("serves an unlinked asset when the caller has drafts:create", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["drafts:create"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [],
      drafts: [],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "png-bytes",
    );
  });

  it("returns 404 for an unlinked asset without drafts:create", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["questions:read"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [],
      drafts: [],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Raw asset not found",
    });
    expect(mockReadLocalUpload).not.toHaveBeenCalled();
  });

  it("serves a question-linked asset with questions:read even without drafts:read", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["questions:read"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [{ id: "question_1" }],
      drafts: [{ id: "draft_1" }],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(200);
    expect(mockReadLocalUpload).toHaveBeenCalledWith("raw/vt.png");
  });

  it("falls through to drafts:read when question-linked but questions:read is missing", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["drafts:read"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [{ id: "question_1" }],
      drafts: [{ id: "draft_1" }],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(200);
  });

  it("does not treat drafts:create as enough for a linked asset", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["drafts:create"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [{ id: "question_1" }],
      drafts: [{ id: "draft_1" }],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(404);
    expect(mockReadLocalUpload).not.toHaveBeenCalled();
  });

  it("serves a draft-linked asset with drafts:read", async () => {
    mockReadAgentAuth.mockResolvedValue(agentAuth(["drafts:read"]));
    mockPrisma.rawAsset.findUnique.mockResolvedValue({
      storageKey: "raw/vt.png",
      mimeType: "image/png",
      questions: [],
      drafts: [{ id: "draft_1" }],
    });

    const response = await getAgentRawAssetFile(fileRequest("raw_1"), {
      params: Promise.resolve({ id: "raw_1" }),
    });

    expect(response.status).toBe(200);
  });
});
