import { NextResponse } from "next/server";

import {
  buildKnowledgePointsResponse,
  listKnowledgePoints,
} from "@/lib/domain/taxonomy-repository";

export async function GET() {
  const knowledgePoints = await listKnowledgePoints();

  return NextResponse.json(buildKnowledgePointsResponse(knowledgePoints));
}
