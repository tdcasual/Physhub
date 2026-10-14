import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  sessionCreate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  sessionFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaMocks.userFindUnique,
    },
    editorSession: {
      create: prismaMocks.sessionCreate,
      deleteMany: prismaMocks.sessionDeleteMany,
      findUnique: prismaMocks.sessionFindUnique,
    },
    apiKey: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  },
}));

import {
  DELETE as deleteLogin,
  POST as postLogin,
} from "@/app/api/auth/login/route";
import { GET as listDrafts, POST as postDrafts } from "@/app/api/drafts/route";
import { GET as getDraft, PATCH as patchDraft } from "@/app/api/drafts/[id]/route";
import { POST as postPromoteDraft } from "@/app/api/drafts/[id]/promote/route";
import { GET as getKnowledgePoints } from "@/app/api/knowledge-points/route";
import { POST as postQuestionSets } from "@/app/api/question-sets/route";
import { POST as postQuestionSetExport } from "@/app/api/question-sets/[id]/export/route";
import { GET as getQuestions, POST as postQuestions } from "@/app/api/questions/route";
import { PATCH as patchQuestion } from "@/app/api/questions/[id]/route";
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
  EDITOR_SESSION_COOKIE_NAME,
  EDITOR_SESSION_HEADER_NAME,
  getConnectingIp,
  readEditorSession,
  requireHumanApiAuth,
  resetEditorUnlockRateLimitForTests,
  TEST_SESSION_TOKEN_ENV,
} from "@/lib/auth/human-auth";
import { hashPassword } from "@/lib/auth/password";

const originalTrustProxy = process.env.TRUST_PROXY;
const originalDevKey = process.env.AGENT_API_KEY_DEV;
const originalTestToken = process.env[TEST_SESSION_TOKEN_ENV];

const LOGIN_PASSWORD = "correct-horse";
let loginPasswordHash = "";

function loginRequest(body: Record<string, string>, headers?: HeadersInit) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function ownerRow() {
  return {
    id: "user_owner",
    username: "owner",
    passwordHash: loginPasswordHash,
    role: "OWNER" as const,
    disabledAt: null,
  };
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
    name: "POST /api/drafts/[id]/promote",
    call: () =>
      postPromoteDraft(
        new Request("http://localhost/api/drafts/draft_1/promote", {
          method: "POST",
        }),
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

beforeAll(async () => {
  loginPasswordHash = await hashPassword(LOGIN_PASSWORD);
});

beforeEach(() => {
  process.env[TEST_SESSION_TOKEN_ENV] = "physhub-test-session-token";
  delete process.env.TRUST_PROXY;
  process.env.AGENT_API_KEY_DEV = "dev-agent-key";
  resetEditorUnlockRateLimitForTests();
  prismaMocks.userFindUnique.mockResolvedValue(ownerRow());
  prismaMocks.sessionCreate.mockResolvedValue({ id: "sess_1" });
  prismaMocks.sessionDeleteMany.mockResolvedValue({ count: 1 });
  prismaMocks.sessionFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  if (originalTrustProxy === undefined) {
    delete process.env.TRUST_PROXY;
  } else {
    process.env.TRUST_PROXY = originalTrustProxy;
  }
  process.env.AGENT_API_KEY_DEV = originalDevKey;
  if (originalTestToken === undefined) {
    delete process.env[TEST_SESSION_TOKEN_ENV];
  } else {
    process.env[TEST_SESSION_TOKEN_ENV] = originalTestToken;
  }
  vi.unstubAllEnvs();
  resetEditorUnlockRateLimitForTests();
});

describe("readEditorSession", () => {
  it("accepts the test session cookie in non-production", async () => {
    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          Cookie: `${EDITOR_SESSION_COOKIE_NAME}=physhub-test-session-token`,
        },
      }),
    );

    expect(session).toEqual({
      userId: "user_owner",
      username: "owner",
      role: "OWNER",
    });
  });

  it("accepts the test token in the non-production header", async () => {
    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: "physhub-test-session-token",
        },
      }),
    );

    expect(session).toEqual({
      userId: "user_owner",
      username: "owner",
      role: "OWNER",
    });
  });

  it("ignores the test header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: "physhub-test-session-token",
        },
      }),
    );

    expect(session).toBeNull();
  });

  it("rejects an unknown token", async () => {
    const session = await readEditorSession(
      new Request("http://localhost/api/questions", {
        headers: {
          Cookie: `${EDITOR_SESSION_COOKIE_NAME}=not-a-session`,
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

describe("POST /api/auth/login", () => {
  it("sets an HttpOnly session cookie on a matching password", async () => {
    const response = await postLogin(
      loginRequest({ username: "owner", password: LOGIN_PASSWORD }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      user: { username: "owner", role: "OWNER" },
    });

    const cookie = response.cookies.get(EDITOR_SESSION_COOKIE_NAME);

    expect(cookie?.value).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.secure).toBe(false);
    expect(prismaMocks.sessionCreate).toHaveBeenCalled();
  });

  it("sets Secure on the cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await postLogin(
      loginRequest({ username: "owner", password: LOGIN_PASSWORD }),
    );

    expect(response.cookies.get(EDITOR_SESSION_COOKIE_NAME)?.secure).toBe(true);
  });

  it("returns 401 for a wrong password", async () => {
    const response = await postLogin(
      loginRequest({ username: "owner", password: "wrong-secret" }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "帐号或密码不正确",
    });
  });

  it("returns 429 after 6 wrong passwords from the same connecting IP", async () => {
    const clientIp = { [CLIENT_IP_HEADER_NAME]: "192.0.2.50" };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postLogin(
        loginRequest({ username: "owner", password: "wrong-secret" }, clientIp),
      );

      expect(response.status).toBe(401);
    }

    const limited = await postLogin(
      loginRequest({ username: "owner", password: "wrong-secret" }, clientIp),
    );

    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({
      error: "Too many unlock attempts",
    });
  });

  it("clears the failure bucket after a successful login", async () => {
    const clientIp = { [CLIENT_IP_HEADER_NAME]: "192.0.2.51" };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await postLogin(
        loginRequest({ username: "owner", password: "wrong-secret" }, clientIp),
      );
      expect(failed.status).toBe(401);
    }

    const unlocked = await postLogin(
      loginRequest({ username: "owner", password: LOGIN_PASSWORD }, clientIp),
    );
    expect(unlocked.status).toBe(200);

    const failedAgain = await postLogin(
      loginRequest({ username: "owner", password: "wrong-secret" }, clientIp),
    );
    expect(failedAgain.status).toBe(401);
  });

  it("expires the session cookie on DELETE without requiring a session", async () => {
    const response = await deleteLogin(
      new Request("http://localhost/api/auth/login", { method: "DELETE" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const cookie = response.cookies.get(EDITOR_SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("does not trust X-Forwarded-For for the unlock rate limit by default", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLogin(
        loginRequest(
          { username: "owner", password: "wrong-secret" },
          { "X-Forwarded-For": "203.0.113.10" },
        ),
      );
    }

    const limited = await postLogin(
      loginRequest(
        { username: "owner", password: "wrong-secret" },
        { "X-Forwarded-For": "198.51.100.20" },
      ),
    );

    expect(limited.status).toBe(429);
  });

  it("keys non-production unlock failures on X-Physhub-Client-Ip", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLogin(
        loginRequest(
          { username: "owner", password: "wrong-secret" },
          { [CLIENT_IP_HEADER_NAME]: "192.0.2.10" },
        ),
      );
    }

    const otherIp = await postLogin(
      loginRequest(
        { username: "owner", password: "wrong-secret" },
        { [CLIENT_IP_HEADER_NAME]: "192.0.2.20" },
      ),
    );
    const sameIp = await postLogin(
      loginRequest(
        { username: "owner", password: "wrong-secret" },
        { [CLIENT_IP_HEADER_NAME]: "192.0.2.10" },
      ),
    );

    expect(otherIp.status).toBe(401);
    expect(sameIp.status).toBe(429);
  });

  it("uses X-Forwarded-For only when TRUST_PROXY=true", async () => {
    process.env.TRUST_PROXY = "true";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await postLogin(
        loginRequest(
          { username: "owner", password: "wrong-secret" },
          { "X-Forwarded-For": "203.0.113.10" },
        ),
      );
    }

    const otherIp = await postLogin(
      loginRequest(
        { username: "owner", password: "wrong-secret" },
        { "X-Forwarded-For": "198.51.100.20" },
      ),
    );
    const sameIp = await postLogin(
      loginRequest(
        { username: "owner", password: "wrong-secret" },
        { "X-Forwarded-For": "203.0.113.10" },
      ),
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

  it("returns 401 for a garbage session token", async () => {
    const response = await getQuestions(
      new Request("http://localhost/api/questions", {
        headers: {
          [EDITOR_SESSION_HEADER_NAME]: "not-a-session",
        },
      }),
    );

    expect(response.status).toBe(401);
  });
});

describe("VIEWER cannot write", () => {
  it("returns 403 Forbidden on PATCH /api/questions/:id", async () => {
    prismaMocks.userFindUnique.mockResolvedValue({
      ...ownerRow(),
      role: "VIEWER",
    });

    const response = await patchQuestion(
      new Request("http://localhost/api/questions/question_1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          [EDITOR_SESSION_HEADER_NAME]: "physhub-test-session-token",
        },
        body: JSON.stringify({ stemMd: "edited" }),
      }),
      { params: Promise.resolve({ id: "question_1" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
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
