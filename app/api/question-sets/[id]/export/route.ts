import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  createQuestionSetExport,
  mapQuestionSetExportApiError,
  parseExportBody,
  readJsonBody,
} from "@/lib/domain/question-set-export";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const body = parseExportBody(await readJsonBody(request));
    const result = await createQuestionSetExport(id, body);

    return NextResponse.json(result);
  } catch (error) {
    const response = mapQuestionSetExportApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
