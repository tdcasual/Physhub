import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  buildTagsResponse,
  listTags,
} from "@/lib/domain/taxonomy-repository";
import { createTag, mapTaxonomyApiError } from "@/lib/domain/taxonomy-write";

export async function GET(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const tags = await listTags();

    return NextResponse.json(buildTagsResponse(tags));
  } catch {
    return NextResponse.json(
      { error: "Failed to load tags" },
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
    const tag = await createTag(await request.json(), prisma);

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    const mapped = mapTaxonomyApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
