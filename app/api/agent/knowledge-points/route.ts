import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  buildKnowledgePointsResponse,
  listKnowledgePoints,
} from "@/lib/domain/taxonomy-repository";

export async function GET(request: Request) {
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:read"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const knowledgePoints = await listKnowledgePoints();

    return NextResponse.json(buildKnowledgePointsResponse(knowledgePoints));
  } catch {
    return NextResponse.json(
      { error: "Failed to load knowledge points" },
      { status: 500 },
    );
  }
}
