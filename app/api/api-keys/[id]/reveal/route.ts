import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  mapApiKeyAdminError,
  revealManagedApiKey,
} from "@/lib/domain/api-key-repository";

type RevealRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RevealRouteContext) {
  const auth = await requireHumanApiAuth(request, { workbench: true });

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const token = await revealManagedApiKey(id);
    return NextResponse.json({ token });
  } catch (error) {
    const mapped = mapApiKeyAdminError(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
