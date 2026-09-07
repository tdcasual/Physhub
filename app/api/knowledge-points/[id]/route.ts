import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  deleteKnowledgePoint,
  mapTaxonomyApiError,
  updateKnowledgePoint,
} from "@/lib/domain/taxonomy-write";

type KnowledgePointRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: KnowledgePointRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const knowledgePoint = await updateKnowledgePoint(
      id,
      await request.json(),
      prisma,
    );

    return NextResponse.json({ knowledgePoint });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}

export async function DELETE(
  request: Request,
  context: KnowledgePointRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await deleteKnowledgePoint(id, prisma);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
