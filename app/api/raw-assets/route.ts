import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  detectRawAssetKind,
  persistParsedRawAsset,
  parseRawAssetFormData,
  RawAssetUploadError,
} from "@/lib/domain/raw-asset-upload";

export { detectRawAssetKind };

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = await parseRawAssetFormData(await request.formData());
    const rawAsset = await persistParsedRawAsset(parsed);

    return NextResponse.json({ rawAsset }, { status: 201 });
  } catch (error) {
    if (error instanceof RawAssetUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create raw asset" },
      { status: 500 },
    );
  }
}
