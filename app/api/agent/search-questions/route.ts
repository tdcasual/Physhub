import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  mapQuestionSearchApiError,
  parseQuestionSearchRequestBody,
} from "@/app/api/search/questions/route";
import { searchQuestions } from "@/lib/search/question-search";

export async function POST(request: Request) {
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:search"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = parseQuestionSearchRequestBody(await request.json());
    const requestedStatus = body.constraints?.status;
    const constraints = {
      ...(body.constraints ?? {}),
      status:
        requestedStatus && requestedStatus.length > 0
          ? requestedStatus
          : ["REVIEWED", "PUBLISHED"],
    };
    const result = await searchQuestions(body.query, constraints);

    return NextResponse.json(result);
  } catch (error) {
    const response = mapQuestionSearchApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
