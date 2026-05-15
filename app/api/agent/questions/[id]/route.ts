import { NextResponse } from "next/server";

import { hasRequiredScopes, readDevAgentScopes } from "@/lib/auth/agent-auth";
import { getQuestion } from "@/lib/domain/question-repository";

type AgentQuestionRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: AgentQuestionRouteContext,
) {
  const scopes = readDevAgentScopes(request);

  if (!scopes || !hasRequiredScopes(scopes, ["questions:read"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const question = await getQuestion(id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Agent reads intentionally use the full repository DTO for the MVP, including
  // answerJson, because the granted scope is an explicit full question read.
  return NextResponse.json({ question });
}
