import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  buildTagsResponse,
  listTags,
} from "@/lib/domain/taxonomy-repository";

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
