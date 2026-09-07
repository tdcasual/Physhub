import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import { readLocalUpload } from "@/lib/storage/storage-service";

type AgentRawAssetFileRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: AgentRawAssetFileRouteContext,
) {
  const agent = await readAgentAuth(request);

  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const rawAsset = await prisma.rawAsset.findUnique({
      where: { id },
      select: {
        storageKey: true,
        mimeType: true,
        questions: { select: { id: true }, take: 1 },
        drafts: { select: { id: true }, take: 1 },
      },
    });

    if (!rawAsset?.storageKey) {
      // Pasted text assets store textContent only; file GET is disk-only.
      return NextResponse.json(
        { error: "Raw asset not found" },
        { status: 404 },
      );
    }

    const linkedToQuestion = rawAsset.questions.length > 0;
    const linkedToDraft = rawAsset.drafts.length > 0;
    const allowed =
      (linkedToQuestion &&
        hasRequiredScopes(agent.scopes, ["questions:read"])) ||
      (linkedToDraft && hasRequiredScopes(agent.scopes, ["drafts:read"])) ||
      (!linkedToQuestion &&
        !linkedToDraft &&
        hasRequiredScopes(agent.scopes, ["drafts:create"]));

    if (!allowed) {
      return NextResponse.json(
        { error: "Raw asset not found" },
        { status: 404 },
      );
    }

    const bytes = await readLocalUpload(rawAsset.storageKey);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": rawAsset.mimeType || "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ error: "Raw asset not found" }, { status: 404 });
  }
}
