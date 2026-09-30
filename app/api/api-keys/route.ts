import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  issueManagedApiKey,
  listManagedApiKeys,
  mapApiKeyAdminError,
} from "@/lib/domain/api-key-repository";

function isIssueBody(body: unknown): body is { name: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    typeof (body as { name?: unknown }).name === "string"
  );
}

export async function GET(request: Request) {
  const auth = await requireHumanApiAuth(request, { workbench: true });

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const apiKeys = await listManagedApiKeys();
    return NextResponse.json({ apiKeys });
  } catch (error) {
    const mapped = mapApiKeyAdminError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request, { workbench: true });

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isIssueBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const issued = await issueManagedApiKey({
      name: body.name,
      createdById: auth.session.userId,
    });

    return NextResponse.json(issued, { status: 201 });
  } catch (error) {
    const mapped = mapApiKeyAdminError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
