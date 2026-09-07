import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  deleteTag,
  mapTaxonomyApiError,
  updateTag,
} from "@/lib/domain/taxonomy-write";

type TagRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: TagRouteContext) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const tag = await updateTag(id, await request.json(), prisma);

    return NextResponse.json({ tag });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}

export async function DELETE(request: Request, context: TagRouteContext) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    await deleteTag(id, prisma);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
