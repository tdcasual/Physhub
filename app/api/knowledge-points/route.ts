import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  buildKnowledgePointsResponse,
  listKnowledgePoints,
} from "@/lib/domain/taxonomy-repository";

export async function GET(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
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
