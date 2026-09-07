import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  createQuestionDraft,
  listQuestionDrafts,
  mapDraftApiError,
} from "@/lib/domain/draft-repository";
import { parseHumanQuestionDraftInput } from "@/lib/domain/draft-schema";

export async function GET(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const drafts = await listQuestionDrafts();

    return NextResponse.json({ drafts });
  } catch {
    return NextResponse.json(
      { error: "Failed to load question drafts" },
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
    const parsed = parseHumanQuestionDraftInput(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const draft = await createQuestionDraft(parsed.data, { actor: "human" });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const mapped = mapDraftApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
