import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";
import {
  mapPromoteApiError,
  promoteDraftToQuestion,
} from "@/lib/domain/promote-draft";

type AgentPromoteDraftRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonWithRequestId(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

async function readOptionalJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();

  if (text.trim() === "") {
    return {};
  }

  return JSON.parse(text) as unknown;
}

export async function POST(
  request: Request,
  context: AgentPromoteDraftRouteContext,
) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:publish"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  const { id } = await context.params;

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await readOptionalJsonBody(request);
    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        const promoted = await promoteDraftToQuestion(id, { db: tx });

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "promote_question_draft",
            status: "SUCCEEDED",
            input: { draftId: id },
            output: {
              questionId: promoted.question.id,
              draftId: promoted.draft.id,
              status: promoted.question.status,
            },
            draftId: promoted.draft.id,
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 201,
          body: {
            request_id: requestId,
            question: promoted.question,
            draft: promoted.draft,
          },
        };
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonWithRequestId(
        { error: "Malformed JSON request body" },
        400,
        requestId,
      );
    }

    if (error instanceof IdempotencyError) {
      return jsonWithRequestId(
        { error: error.message },
        error.status,
        requestId,
      );
    }

    const mapped = mapPromoteApiError(error);

    return jsonWithRequestId(
      { error: mapped.error },
      mapped.status,
      requestId,
    );
  }
}
