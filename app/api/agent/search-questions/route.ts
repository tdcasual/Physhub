import { NextResponse } from "next/server";

import { hasRequiredScopes, readDevAgentScopes } from "@/lib/auth/agent-auth";
import {
  mapQuestionSearchApiError,
  parseQuestionSearchRequestBody,
} from "@/app/api/search/questions/route";
import { searchQuestions } from "@/lib/search/question-search";

export async function POST(request: Request) {
  const scopes = readDevAgentScopes(request);

  if (!scopes || !hasRequiredScopes(scopes, ["questions:search"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = parseQuestionSearchRequestBody(await request.json());
    const result = await searchQuestions(body.query, body.constraints);

    return NextResponse.json(result);
  } catch (error) {
    const response = mapQuestionSearchApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
