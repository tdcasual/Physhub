import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { parseRawAsset } from "@/lib/domain/parse-raw-asset-workflow";

type RawAssetParseRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: RawAssetParseRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  let result: Awaited<ReturnType<typeof parseRawAsset>>;

  try {
    result = await parseRawAsset(id);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse raw asset" },
      { status: 500 },
    );
  }

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Raw asset not found" }, { status: 404 });
  }

  if (result.status === "failed") {
    return NextResponse.json(
      { error: "Failed to parse raw asset" },
      { status: 500 },
    );
  }

  return NextResponse.json({ draft: result.draft }, { status: 201 });
}
