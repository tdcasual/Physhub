import { NextResponse } from "next/server";

import {
  createQuestion,
  listQuestions,
  QuestionPersistenceError,
  QuestionRelationError,
  QuestionValidationError,
} from "@/lib/domain/question-repository";

export type QuestionApiErrorResponse = {
  error: string;
  status: 400 | 422 | 500;
};

export function mapQuestionApiError(error: unknown): QuestionApiErrorResponse {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof QuestionValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof QuestionRelationError) {
    return { error: error.message, status: 422 };
  }

  if (error instanceof QuestionPersistenceError) {
    return { error: error.message, status: 500 };
  }

  return { error: "Unable to create question", status: 500 };
}

export async function GET() {
  const questions = await listQuestions();

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  try {
    const question = await createQuestion(await request.json());

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const response = mapQuestionApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
