import { NextResponse } from "next/server";

import {
  createQuestion,
  listQuestions,
  QuestionValidationError,
} from "@/lib/domain/question-repository";

export async function GET() {
  const questions = await listQuestions();

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  try {
    const question = await createQuestion(await request.json());

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    if (error instanceof QuestionValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to create question" },
      { status: 400 },
    );
  }
}
