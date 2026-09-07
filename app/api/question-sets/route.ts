import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import {
  createQuestionSet,
  QuestionSetPersistenceError,
  QuestionSetRelationError,
  QuestionSetValidationError,
} from "@/lib/domain/question-set-service";

export type QuestionSetApiErrorResponse = {
  error: string;
  status: 400 | 422 | 500;
};

export function mapQuestionSetApiError(
  error: unknown,
): QuestionSetApiErrorResponse {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof QuestionSetValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof QuestionSetRelationError) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof QuestionSetPersistenceError) {
    return { error: "Unable to create question set", status: 500 };
  }

  return { error: "Unable to create question set", status: 500 };
}

export async function POST(request: Request) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const questionSet = await createQuestionSet(await request.json());

    return NextResponse.json({ questionSet }, { status: 201 });
  } catch (error) {
    const response = mapQuestionSetApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
