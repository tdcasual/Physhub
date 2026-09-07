import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  buildKnowledgePointsResponse,
  listKnowledgePoints,
} from "@/lib/domain/taxonomy-repository";
import {
  createKnowledgePoint,
  mapTaxonomyApiError,
} from "@/lib/domain/taxonomy-write";

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

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const knowledgePoint = await createKnowledgePoint(
      await request.json(),
      prisma,
    );

    return NextResponse.json({ knowledgePoint }, { status: 201 });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
