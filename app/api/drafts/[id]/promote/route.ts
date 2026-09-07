import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  mapPromoteApiError,
  promoteDraftToQuestion,
} from "@/lib/domain/promote-draft";

type PromoteDraftRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: PromoteDraftRouteContext,
) {
  const auth = await requireHumanApiAuth(request, { publishRoute: true });

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const result = await promoteDraftToQuestion(id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = mapPromoteApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
