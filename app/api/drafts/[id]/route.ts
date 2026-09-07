import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  getQuestionDraft,
  mapDraftApiError,
  updateQuestionDraft,
} from "@/lib/domain/draft-repository";
import { parseHumanQuestionDraftInput } from "@/lib/domain/draft-schema";

type HumanQuestionDraftRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: HumanQuestionDraftRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const draft = await getQuestionDraft(id);

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json(
      { error: "Failed to load question draft" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: HumanQuestionDraftRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const parsed = parseHumanQuestionDraftInput(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const draft = await updateQuestionDraft(id, parsed.data, {
      actor: "human",
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const mapped = mapDraftApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
