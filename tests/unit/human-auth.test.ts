import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
}));

import { POST as postEditorSession } from "@/app/api/auth/editor-session/route";
import { GET as listDrafts, POST as postDrafts } from "@/app/api/drafts/route";
import { GET as getDraft, PATCH as patchDraft } from "@/app/api/drafts/[id]/route";
import { GET as getKnowledgePoints } from "@/app/api/knowledge-points/route";
import { POST as postQuestionSets } from "@/app/api/question-sets/route";
import { POST as postQuestionSetExport } from "@/app/api/question-sets/[id]/export/route";
import { GET as getQuestions, POST as postQuestions } from "@/app/api/questions/route";
import { POST as postClassifyQuestion } from "@/app/api/questions/[id]/classify/route";
import { GET as getQuestion } from "@/app/api/questions/[id]/route";
import { POST as postRawAssets } from "@/app/api/raw-assets/route";
import { GET as getRawAssetFile } from "@/app/api/raw-assets/[id]/file/route";
import { POST as postParseRawAsset } from "@/app/api/raw-assets/[id]/parse/route";
import { POST as postSearchQuestions } from "@/app/api/search/questions/route";
import { PATCH as patchSuggestion } from "@/app/api/suggestions/[id]/route";
import { GET as getTags } from "@/app/api/tags/route";
import {
  CLIENT_IP_HEADER_NAME,
  computeEditorSessionCookieValue,
  EDITOR_SESSION_COOKIE_NAME,
  EDITOR_SESSION_HEADER_NAME,
  EDITOR_SESSION_HMAC_MESSAGE,
  getConnectingIp,
  OWNER_PLACEHOLDER_USER_ID,
  readEditorSession,
  requireHumanApiAuth,
  resetEditorUnlockRateLimitForTests,
} from "@/lib/auth/human-auth";

const originalEditorSecret = process.env.EDITOR_SESSION_SECRET;
const originalTrustProxy = process.env.TRUST_PROXY;
const originalDevKey = process.env.AGENT_API_KEY_DEV;

function hmacFor(secret: string) {
  return createHmac("sha256", secret)
    .update(EDITOR_SESSION_HMAC_MESSAGE)
    .digest("hex");
}

function unlockRequest(
  secret: string,
  headers?: HeadersInit,
) {
  return new Request("http://localhost/api/auth/editor-session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ secret }),
  });
}

const unauthenticatedHumanRoutes: Array<{
  name: string;
  call: () => Promise<Response>;
}> = [
  {
    name: "GET /api/questions",
    call: () => getQuestions(new Request("http://localhost/api/questions")),
  },
  {
    name: "POST /api/questions",
    call: () =>
      postQuestions(
        new Request("http://localhost/api/questions", { method: "POST" }),
      ),
  },
  {
    name: "GET /api/questions/[id]",
    call: () =>
      getQuestion(new Request("http://localhost/api/questions/question_1"), {
        params: Promise.resolve({ id: "question_1" }),
      }),
  },
  {
    name: "POST /api/questions/[id]/classify",
    call: () =>
      postClassifyQuestion(
        new Request("http://localhost/api/questions/question_1/classify", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "question_1" }) },
      ),
  },
  {
    name: "POST /api/search/questions",
    call: () =>
      postSearchQuestions(
        new Request("http://localhost/api/search/questions", {
          method: "POST",
        }),
      ),
  },
  {
    name: "GET /api/knowledge-points",
    call: () =>
      getKnowledgePoints(new Request("http://localhost/api/knowledge-points")),
  },
  {
    name: "GET /api/tags",
    call: () => getTags(new Request("http://localhost/api/tags")),
  },
  {
    name: "POST /api/drafts",
    call: () =>
      postDrafts(new Request("http://localhost/api/drafts", { method: "POST" })),
  },
  {
    name: "GET /api/drafts",
    call: () => listDrafts(new Request("http://localhost/api/drafts")),
  },
  {
    name: "GET /api/drafts/[id]",
    call: () =>
      getDraft(new Request("http://localhost/api/drafts/draft_1"), {
        params: Promise.resolve({ id: "draft_1" }),
      }),
  },
  {
    name: "PATCH /api/drafts/[id]",
    call: () =>
      patchDraft(
        new Request("http://localhost/api/drafts/draft_1", { method: "PATCH" }),
        { params: Promise.resolve({ id: "draft_1" }) },
      ),
  },
  {
    name: "POST /api/raw-assets",
    call: () =>
      postRawAssets(
        new Request("http://localhost/api/raw-assets", { method: "POST" }),
      ),
  },
  {
    name: "GET /api/raw-assets/[id]/file",
    call: () =>
      getRawAssetFile(
        new Request("http://localhost/api/raw-assets/raw_1/file"),
        { params: Promise.resolve({ id: "raw_1" }) },
      ),
  },
  {
    name: "POST /api/raw-assets/[id]/parse",
    call: () =>
      postParseRawAsset(
        new Request("http://localhost/api/raw-assets/raw_1/parse", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "raw_1" }) },
      ),
  },
  {
    name: "PATCH /api/suggestions/[id]",
    call: () =>
      patchSuggestion(
        new Request("http://localhost/api/suggestions/suggestion_1", {
          method: "PATCH",
        }),
        { params: Promise.resolve({ id: "suggestion_1" }) },
      ),
  },
  {
    name: "POST /api/question-sets",
    call: () =>
      postQuestionSets(
        new Request("http://localhost/api/question-sets", { method: "POST" }),
      ),
  },
  {
    name: "POST /api/question-sets/[id]/export",
    call: () =>
      postQuestionSetExport(
        new Request("http://localhost/api/question-sets/set_1/export", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "set_1" }) },
      ),
  },
];

beforeEach(() => {
  process.env.EDITOR_SESSION_SECRET = "test-editor-session-secret";
  delete process.env.TRUST_PROXY;
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  resetEditorUnlockRateLimitForTests();
});

afterEach(() => {
  process.env.EDITOR_SESSION_SECRET = originalEditorSecret;
  if (originalTrustProxy === undefined) {
    delete process.env.TRUST_PROXY;
  } else {
    process.env.TRUST_PROXY = originalTrustProxy;
  }
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  vi.unstubAllEnvs();
  resetEditorUnlockRateLimitForTests();
});

describe("editor session cookie HMAC", () => {
  it("equals hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message=physhub_editor.v1))", () => {
    const secret = "0123456789abcdef0123456789abcdef";

    expect(computeEditorSessionCookieValue(secret)).toBe(hmacFor(secret));
  });
});

describe("readEditorSession", () => {
  it("accepts the HMAC cookie", async () => {
    const secret = "test-editor-session-secret";
    const cookie = computeEditorSessionCookieValue(secret);

    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: { Cookie: `${EDITOR_SESSION_COOKIE_NAME}=${cookie}` },
      }),
    );

    expect(session).toEqual({
      userId: OWNER_PLACEHOLDER_USER_ID,
      role: "OWNER",
    });
  });

  it("rejects a plaintext secret in the non-production test header", async () => {
    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: "test-editor-session-secret",
        },
      }),
    );

    expect(session).toBeNull();
  });

  it("accepts the HMAC hex in the non-production test header", async () => {
    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: computeEditorSessionCookieValue(
            "test-editor-session-secret",
          ),
        },
      }),
    );

    expect(session).toEqual({
      userId: OWNER_PLACEHOLDER_USER_ID,
      role: "OWNER",
    });
  });

  it("ignores the test header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: computeEditorSessionCookieValue(
            "test-editor-session-secret",
          ),
        },
      }),
    );

    expect(session).toBeNull();
  });

  it("fails closed when EDITOR_SESSION_SECRET is missing", async () => {
    delete process.env.EDITOR_SESSION_SECRET;

    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          Cookie: `${EDITOR_SESSION_COOKIE_NAME}=anything`,
          [EDITOR_SESSION_HEADER_NAME]: "anything",
        },
      }),
    );

    expect(session).toBeNull();
  });
});

describe("connecting IP", () => {
  it("ignores X-Forwarded-For unless TRUST_PROXY=true", () => {
    const request = new Request("http://localhost/api/auth/editor-session", {
      headers: { "X-Forwarded-For": "203.0.113.10, 10.0.0.1" },
    });

    expect(getConnectingIp(request)).toBe("local");

    process.env.TRUST_PROXY = "true";

    expect(getConnectingIp(request)).toBe("203.0.113.10");
  });

  it("uses X-Physhub-Client-Ip as the rate-limit key outside production", () => {
    const request = new Request("http://localhost/api/auth/editor-session", {
      headers: {
        "X-Forwarded-For": "203.0.113.10",
        [CLIENT_IP_HEADER_NAME]: "192.0.2.10",
      },
    });

    expect(getConnectingIp(request)).toBe("192.0.2.10");
  });

  it("ignores X-Physhub-Client-Ip in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = new Request("http://localhost/api/auth/editor-session", {
      headers: { [CLIENT_IP_HEADER_NAME]: "192.0.2.10" },
    });

    expect(getConnectingIp(request)).toBe("local");
  });
});

describe("POST /api/auth/editor-session", () => {
  it("sets an HttpOnly session cookie on a matching secret", async () => {
    const secret = "test-editor-session-secret";
    const response = await postEditorSession(unlockRequest(secret));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const cookie = response.cookies.get(EDITOR_SESSION_COOKIE_NAME);

    expect(cookie?.value).toBe(computeEditorSessionCookieValue(secret));
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBeUndefined();
    expect(cookie?.secure).toBe(false);
  });

  it("sets Secure on the cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await postEditorSession(
      unlockRequest("test-editor-session-secret"),
    );

    expect(response.cookies.get(EDITOR_SESSION_COOKIE_NAME)?.secure).toBe(true);
  });

  it("returns 401 for a wrong secret", async () => {
    const response = await postEditorSession(unlockRequest("wrong-secret"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 429 after 6 wrong secrets from the same connecting IP", async () => {
    const clientIp = { [CLIENT_IP_HEADER_NAME]: "192.0.2.50" };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postEditorSession(
        unlockRequest("wrong-secret", clientIp),
      );

      expect(response.status).toBe(401);
    }

    const limited = await postEditorSession(
      unlockRequest("wrong-secret", clientIp),
    );

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      error: "Too many unlock attempts",
    });
  });

  it("does not trust X-Forwarded-For for the unlock rate limit by default", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postEditorSession(
        unlockRequest("wrong-secret", { "X-Forwarded-For": "203.0.113.10" }),
      );
    }

    const limited = await postEditorSession(
      unlockRequest("wrong-secret", { "X-Forwarded-For": "198.51.100.20" }),
    );

    expect(limited.status).toBe(429);
  });

  it("keys non-production unlock failures on X-Physhub-Client-Ip", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postEditorSession(
        unlockRequest("wrong-secret", {
          [CLIENT_IP_HEADER_NAME]: "192.0.2.10",
        }),
      );
    }

    const otherIp = await postEditorSession(
      unlockRequest("wrong-secret", { [CLIENT_IP_HEADER_NAME]: "192.0.2.20" }),
    );
    const sameIp = await postEditorSession(
      unlockRequest("wrong-secret", { [CLIENT_IP_HEADER_NAME]: "192.0.2.10" }),
    );

    expect(otherIp.status).toBe(401);
    expect(sameIp.status).toBe(429);
  });

  it("uses X-Forwarded-For only when TRUST_PROXY=true", async () => {
    process.env.TRUST_PROXY = "true";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postEditorSession(
        unlockRequest("wrong-secret", { "X-Forwarded-For": "203.0.113.10" }),
      );
    }

    const otherIp = await postEditorSession(
      unlockRequest("wrong-secret", { "X-Forwarded-For": "198.51.100.20" }),
    );
    const sameIp = await postEditorSession(
      unlockRequest("wrong-secret", { "X-Forwarded-For": "203.0.113.10" }),
    );

    expect(otherIp.status).toBe(401);
    expect(sameIp.status).toBe(429);
  });
});

describe("human API routes require an editor session", () => {
  it.each(unauthenticatedHumanRoutes)(
    "returns 401 for $name without a session",
    async ({ call }) => {
      const response = await call();

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    },
  );

  it("returns 401 for every human route when EDITOR_SESSION_SECRET is missing", async () => {
    delete process.env.EDITOR_SESSION_SECRET;

    const response = await getQuestions(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: hmacFor("test-editor-session-secret"),
        },
      }),
    );

    expect(response.status).toBe(401);
  });
});

describe("agent keys are rejected on human routes", () => {
  it("returns 403 Agent key not accepted on human routes", async () => {
    const auth = await requireHumanApiAuth(
      new Request("http://localhost/api/suggestions/suggestion_1", {
        method: "PATCH",
        headers: { Authorization: "Bearer dev-agent-key" },
      }),
    );

    expect(auth.ok).toBe(false);
    if (auth.ok) {
      throw new Error("expected an auth error");
    }

    expect(auth.response.status).toBe(403);
    await expect(auth.response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
  });

  it("rejects a valid agent bearer on PATCH /api/suggestions/[id]", async () => {
    const response = await patchSuggestion(
      new Request("http://localhost/api/suggestions/suggestion_1", {
        method: "PATCH",
        headers: { Authorization: "Bearer dev-agent-key" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      { params: Promise.resolve({ id: "suggestion_1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent key not accepted on human routes",
    });
  });
});
