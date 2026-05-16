import { NextResponse } from "next/server";

import {
  createQuestionSet,
  QuestionSetValidationError,
} from "@/lib/domain/question-set-service";

export type QuestionSetApiErrorResponse = {
  error: string;
  status: 400 | 500;
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

  return { error: "Unable to create question set", status: 500 };
}

export async function POST(request: Request) {
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
