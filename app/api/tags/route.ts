import { NextResponse } from "next/server";

import {
  buildTagsResponse,
  listTags,
} from "@/lib/domain/taxonomy-repository";

export async function GET() {
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
