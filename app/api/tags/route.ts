import { NextResponse } from "next/server";

import {
  buildTagsResponse,
  listTags,
} from "@/lib/domain/taxonomy-repository";

export async function GET() {
  const tags = await listTags();

  return NextResponse.json(buildTagsResponse(tags));
}
