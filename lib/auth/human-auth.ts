import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { readAgentAuth } from "@/lib/auth/agent-auth";
import { timingSafeEqualString } from "@/lib/auth/secure-compare";

export const EDITOR_SESSION_COOKIE_NAME = "physhub_editor";
export const EDITOR_SESSION_HEADER_NAME = "X-Physhub-Editor-Session";
export const EDITOR_SESSION_HMAC_MESSAGE = "physhub_editor.v1";
export const CLIENT_IP_HEADER_NAME = "X-Physhub-Client-Ip";
export const OWNER_PLACEHOLDER_USER_ID = "seed-owner";
export const OWNER_SEED_EMAIL = "owner@example.com";

const UNLOCK_FAILURE_LIMIT = 5;
const UNLOCK_FAILURE_WINDOW_MS = 60_000;
const LOCAL_CONNECTING_IP = "local";

export type EditorSession = {
  userId: string;
  role: "OWNER";
};

export type HumanAuthResult =
  | { ok: true; session: EditorSession }
  | { ok: false; response: NextResponse };

type UnlockFailureWindow = {
  count: number;
  resetAt: number;
};

const unlockFailures = new Map<string, UnlockFailureWindow>();

export function computeEditorSessionCookieValue(secret: string): string {
  return createHmac("sha256", secret)
    .update(EDITOR_SESSION_HMAC_MESSAGE)
    .digest("hex");
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

async function resolveOwnerUserId(): Promise<string> {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_SEED_EMAIL },
      select: { id: true },
    });

    return owner?.id ?? OWNER_PLACEHOLDER_USER_ID;
  } catch {
    return OWNER_PLACEHOLDER_USER_ID;
  }
}

export async function readEditorSession(
  request: Request,
): Promise<EditorSession | null> {
  const secret = process.env.EDITOR_SESSION_SECRET;

  if (!secret) {
    return null;
  }

  const expected = computeEditorSessionCookieValue(secret);
  const cookieValue = readCookieValue(request, EDITOR_SESSION_COOKIE_NAME);

  if (cookieValue !== null) {
    if (!timingSafeEqualString(cookieValue, expected)) {
      return null;
    }

    return {
      userId: await resolveOwnerUserId(),
      role: "OWNER",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const headerValue = request.headers.get(EDITOR_SESSION_HEADER_NAME);

    if (headerValue && timingSafeEqualString(headerValue, expected)) {
      return {
        userId: await resolveOwnerUserId(),
        role: "OWNER",
      };
    }
  }

  return null;
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

  // App Router Request has no TCP socket, so production without TRUST_PROXY shares one local bucket.
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
  const window = getUnlockFailureWindow(
    getConnectingIp(request),
    Date.now(),
  );

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

export function resetEditorUnlockRateLimitForTests(): void {
  unlockFailures.clear();
}

export async function requireHumanApiAuth(
  request: Request,
  options?: { publishRoute?: boolean },
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

  return { ok: true, session };
}
