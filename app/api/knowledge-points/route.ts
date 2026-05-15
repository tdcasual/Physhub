import { NextResponse } from "next/server";

import {
  buildKnowledgePointsResponse,
  listKnowledgePoints,
} from "@/lib/domain/taxonomy-repository";

export async function GET() {
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
