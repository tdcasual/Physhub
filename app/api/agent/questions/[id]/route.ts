import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
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
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:read"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let question;
  try {
    question = await getQuestion(id);
  } catch {
    return NextResponse.json(
      { error: "Failed to load question" },
      { status: 500 },
    );
  }

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Agent reads intentionally use the full repository DTO for the MVP, including
  // answerJson, because the granted scope is an explicit full question read.
  return NextResponse.json({ question });
}
