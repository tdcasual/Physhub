import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";
import {
  mapOfficialQuestionApiError,
  updateOfficialQuestionContent,
  updateOfficialQuestionStatus,
} from "@/lib/domain/official-question";
import { getQuestion } from "@/lib/domain/question-repository";

type QuestionRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: QuestionRouteContext) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const question = await getQuestion(id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({ question });
}

export async function PATCH(request: Request, context: QuestionRouteContext) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const status =
      typeof body === "object" && body !== null && "status" in body
        ? (body as { status?: unknown }).status
        : undefined;

    if (status === "PUBLISHED" || status === "DEPRECATED") {
      const result = await updateOfficialQuestionStatus(
        id,
        status,
        auth.session.userId,
        prisma,
      );

      return NextResponse.json(result);
    }

    const result = await updateOfficialQuestionContent(
      id,
      body,
      auth.session.userId,
      prisma,
    );

    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapOfficialQuestionApiError(error);

    return NextResponse.json(
      { error: mapped.error },
      { status: mapped.status },
    );
  }
}
