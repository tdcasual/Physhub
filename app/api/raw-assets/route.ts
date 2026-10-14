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
  const auth = await requireHumanApiAuth(request, { workbench: true });

  if (!auth.ok) {
    return auth.response;
  }

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = await parseRawAssetFormData(formData);
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
