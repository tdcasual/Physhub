import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import { buildTagsResponse, listTags } from "@/lib/domain/taxonomy-repository";

export async function GET(request: Request) {
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:read"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tags = await listTags();

    return NextResponse.json(buildTagsResponse(tags));
  } catch {
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 });
  }
}
