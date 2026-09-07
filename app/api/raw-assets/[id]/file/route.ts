import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { readLocalUpload } from "@/lib/storage/storage-service";

type RawAssetFileRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RawAssetFileRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const rawAsset = await prisma.rawAsset.findUnique({
      where: { id },
      select: {
        storageKey: true,
        mimeType: true,
      },
    });

    if (!rawAsset?.storageKey) {
      return NextResponse.json(
        { error: "Raw asset not found" },
        { status: 404 },
      );
    }

    const bytes = await readLocalUpload(rawAsset.storageKey);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": rawAsset.mimeType || "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ error: "Raw asset not found" }, { status: 404 });
  }
}
