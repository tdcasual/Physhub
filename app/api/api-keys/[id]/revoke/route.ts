import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  mapApiKeyAdminError,
  revokeManagedApiKey,
} from "@/lib/domain/api-key-repository";

type RevokeRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RevokeRouteContext) {
  const auth = await requireHumanApiAuth(request, { workbench: true });

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const apiKey = await revokeManagedApiKey(id);
    return NextResponse.json({ apiKey });
  } catch (error) {
    const mapped = mapApiKeyAdminError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
