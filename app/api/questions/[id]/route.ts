import { NextResponse } from "next/server";

import { getQuestion } from "@/lib/domain/question-repository";

type QuestionRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: QuestionRouteContext) {
  const { id } = await context.params;
  const question = await getQuestion(id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({ question });
}
