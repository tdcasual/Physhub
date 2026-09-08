import { NextResponse } from "next/server";

import {
  computeEditorSessionCookieValue,
  EDITOR_SESSION_COOKIE_NAME,
  isEditorUnlockRateLimited,
  recordEditorUnlockFailure,
  recordEditorUnlockSuccess,
} from "@/lib/auth/human-auth";
import { timingSafeEqualString } from "@/lib/auth/secure-compare";

function isSecretBody(body: unknown): body is { secret: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { secret?: unknown }).secret === "string"
  );
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
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!isSecretBody(body)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const configuredSecret = process.env.EDITOR_SESSION_SECRET;

  if (
    !configuredSecret ||
    !timingSafeEqualString(body.secret, configuredSecret)
  ) {
    recordEditorUnlockFailure(request);

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  recordEditorUnlockSuccess(request);

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: EDITOR_SESSION_COOKIE_NAME,
    value: computeEditorSessionCookieValue(configuredSecret),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function expireEditorSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: EDITOR_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  expireEditorSessionCookie(response);
  return response;
}
