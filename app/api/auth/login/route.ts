import { NextResponse } from "next/server";

import {
  createSessionToken,
  EDITOR_SESSION_COOKIE_NAME,
  hashSessionToken,
  isEditorUnlockRateLimited,
  recordEditorUnlockFailure,
  recordEditorUnlockSuccess,
  SESSION_TTL_MS,
  sessionCookieOptions,
} from "@/lib/auth/human-auth";
import {
  isUsablePassword,
  isUsableUsername,
  verifyPassword,
} from "@/lib/auth/password";

const LOGIN_ERROR = "帐号或密码不正确";

function isLoginBody(
  body: unknown,
): body is { username: string; password: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { username?: unknown }).username === "string" &&
    typeof (body as { password?: unknown }).password === "string"
  );
}

function expireSessionCookie(response: NextResponse) {
  response.cookies.set({
    ...sessionCookieOptions(0),
    value: "",
  });
}

export async function POST(request: Request) {
  if (isEditorUnlockRateLimited(request)) {
    return NextResponse.json(
      { error: "Too many unlock attempts" },
      { status: 429 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isLoginBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const username = body.username.trim();
  const password = body.password;

  if (!isUsableUsername(username) || !isUsablePassword(password)) {
    recordEditorUnlockFailure(request);
    return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        disabledAt: true,
      },
    });

    const passwordOk = await verifyPassword(password, user?.passwordHash);

    if (!user || user.disabledAt != null || !passwordOk) {
      recordEditorUnlockFailure(request);
      return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
    }

    if (user.role !== "OWNER" && user.role !== "EDITOR") {
      recordEditorUnlockFailure(request);
      return NextResponse.json({ error: LOGIN_ERROR }, { status: 401 });
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await prisma.editorSession.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });

    recordEditorUnlockSuccess(request);

    const response = NextResponse.json({
      ok: true,
      user: { username: user.username, role: user.role },
    });

    response.cookies.set({
      ...sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)),
      value: token,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Unable to unlock" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  let token: string | null = null;

  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }
      if (part.slice(0, separatorIndex).trim() === EDITOR_SESSION_COOKIE_NAME) {
        token = part.slice(separatorIndex + 1).trim();
      }
    }
  }

  if (token) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.editorSession.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    } catch {
      // Cookie is still cleared below.
    }
  }

  const response = NextResponse.json({ ok: true });
  expireSessionCookie(response);
  return response;
}
