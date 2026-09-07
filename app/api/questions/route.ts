import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { DraftNotFoundError, DraftRelationError } from "@/lib/domain/draft-repository";
import {
  createQuestionByPromotingDraft,
  DraftNotPromotableError,
  mapPromoteApiError,
} from "@/lib/domain/promote-draft";
import {
  listQuestions,
  QuestionPersistenceError,
  QuestionRelationError,
  QuestionValidationError,
} from "@/lib/domain/question-repository";

export type QuestionApiErrorResponse = {
  error: string;
  status: 400 | 404 | 409 | 422 | 500;
};

export function mapQuestionApiError(error: unknown): QuestionApiErrorResponse {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof QuestionValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof DraftNotFoundError) {
    return { error: error.message, status: 404 };
  }

  if (error instanceof DraftNotPromotableError) {
    return { error: error.message, status: 409 };
  }

  if (
    error instanceof QuestionRelationError ||
    error instanceof DraftRelationError
  ) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof QuestionPersistenceError) {
    return { error: error.message, status: 500 };
  }

  const promoted = mapPromoteApiError(error);

  if (promoted.status !== 500) {
    return {
      error: promoted.error,
      status: promoted.status as QuestionApiErrorResponse["status"],
    };
  }

  return { error: "Unable to create question", status: 500 };
}

export async function GET(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const questions = await listQuestions();

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request, { publishRoute: true });

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await createQuestionByPromotingDraft(await request.json());

    return NextResponse.json({ question: result.question }, { status: 201 });
  } catch (error) {
    const response = mapQuestionApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
