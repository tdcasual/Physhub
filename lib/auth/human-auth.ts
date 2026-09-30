import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { readAgentAuth } from "@/lib/auth/agent-auth";
import { timingSafeEqualString } from "@/lib/auth/secure-compare";

export const EDITOR_SESSION_COOKIE_NAME = "physhub_session";
export const EDITOR_SESSION_HEADER_NAME = "X-Physhub-Editor-Session";
export const CLIENT_IP_HEADER_NAME = "X-Physhub-Client-Ip";
export const OWNER_PLACEHOLDER_USER_ID = "seed-owner";
export const OWNER_SEED_EMAIL = "owner@example.com";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const TEST_SESSION_TOKEN_ENV = "PHYSHUB_TEST_SESSION_TOKEN";

const UNLOCK_FAILURE_LIMIT = 5;
const UNLOCK_FAILURE_WINDOW_MS = 60_000;
const LOCAL_CONNECTING_IP = "local";

export type EditorSession = {
  userId: string;
  username: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
};

export type HumanAuthResult =
  | { ok: true; session: EditorSession }
  | { ok: false; response: NextResponse };

type UnlockFailureWindow = {
  count: number;
  resetAt: number;
};

const unlockFailures = new Map<string, UnlockFailureWindow>();

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function readCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");

  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = part.slice(0, separatorIndex).trim();

    if (cookieName === name) {
      return part.slice(separatorIndex + 1).trim();
    }
  }

  return null;
}

function readSessionToken(request: Request): string | null {
  const cookieValue = readCookieValue(request, EDITOR_SESSION_COOKIE_NAME);

  if (cookieValue) {
    return cookieValue;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const headerValue = request.headers.get(EDITOR_SESSION_HEADER_NAME)?.trim();

  return headerValue && headerValue.length > 0 ? headerValue : null;
}

async function resolveOwnerFallback(): Promise<EditorSession> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_SEED_EMAIL },
      select: { id: true, username: true, role: true, disabledAt: true },
    });

    if (owner && owner.disabledAt == null) {
      const role =
        owner.role === "EDITOR" || owner.role === "VIEWER"
          ? owner.role
          : "OWNER";

      return {
        userId: owner.id,
        username: owner.username ?? "owner",
        role,
      };
    }
  } catch {
    // Tests may mock Prisma without a User table.
  }

  return {
    userId: OWNER_PLACEHOLDER_USER_ID,
    username: "owner",
    role: "OWNER",
  };
}

async function sessionFromToken(token: string): Promise<EditorSession | null> {
  const testToken = process.env[TEST_SESSION_TOKEN_ENV];

  if (
    process.env.NODE_ENV !== "production" &&
    testToken &&
    timingSafeEqualString(token, testToken)
  ) {
    return resolveOwnerFallback();
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const row = await prisma.editorSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            disabledAt: true,
          },
        },
      },
    });

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (row.user.disabledAt != null) {
      return null;
    }

    return {
      userId: row.user.id,
      username: row.user.username,
      role: row.user.role,
    };
  } catch {
    return null;
  }
}

export async function readEditorSession(
  request: Request,
): Promise<EditorSession | null> {
  const token = readSessionToken(request);

  if (!token) {
    return null;
  }

  return sessionFromToken(token);
}

export async function readEditorSessionFromCookies(): Promise<EditorSession | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(EDITOR_SESSION_COOKIE_NAME)?.value ?? null;

  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return null;
  }

  return sessionFromToken(token);
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    name: EDITOR_SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

export function getConnectingIp(request: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for");

    if (forwarded) {
      const firstHop = forwarded.split(",")[0]?.trim();

      if (firstHop) {
        return firstHop;
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();

    if (realIp) {
      return realIp;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const testClientIp = request.headers.get(CLIENT_IP_HEADER_NAME)?.trim();

    if (testClientIp) {
      return testClientIp;
    }
  }

  return LOCAL_CONNECTING_IP;
}

function getUnlockFailureWindow(
  ip: string,
  now: number,
): UnlockFailureWindow | null {
  const existing = unlockFailures.get(ip);

  if (!existing) {
    return null;
  }

  if (now >= existing.resetAt) {
    unlockFailures.delete(ip);
    return null;
  }

  return existing;
}

export function isEditorUnlockRateLimited(request: Request): boolean {
  const window = getUnlockFailureWindow(getConnectingIp(request), Date.now());

  return window != null && window.count >= UNLOCK_FAILURE_LIMIT;
}

export function recordEditorUnlockFailure(request: Request): void {
  const ip = getConnectingIp(request);
  const now = Date.now();
  const existing = getUnlockFailureWindow(ip, now);

  if (!existing) {
    unlockFailures.set(ip, {
      count: 1,
      resetAt: now + UNLOCK_FAILURE_WINDOW_MS,
    });
    return;
  }

  existing.count += 1;
}

export function recordEditorUnlockSuccess(request: Request): void {
  unlockFailures.delete(getConnectingIp(request));
}

export function resetEditorUnlockRateLimitForTests(): void {
  unlockFailures.clear();
}

export function canEditWorkbench(session: EditorSession): boolean {
  return session.role === "OWNER" || session.role === "EDITOR";
}

export async function requireHumanApiAuth(
  request: Request,
  options?: { publishRoute?: boolean; workbench?: boolean },
): Promise<HumanAuthResult> {
  const agent = await readAgentAuth(request);

  if (agent) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: options?.publishRoute
            ? "Agent cannot publish questions"
            : "Agent key not accepted on human routes",
        },
        { status: 403 },
      ),
    };
  }

  const session = await readEditorSession(request);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (
    (options?.publishRoute || options?.workbench) &&
    !canEditWorkbench(session)
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
