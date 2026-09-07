import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import { mapQuestionSetApiError } from "@/app/api/question-sets/route";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";
import { createQuestionSet } from "@/lib/domain/question-set-service";

function jsonWithRequestId(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["question_sets:create"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await request.json();
    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        const questionSet = await createQuestionSet(rawBody, tx);

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "create_question_set",
            status: "SUCCEEDED",
            input: rawBody,
            output: { questionSetId: questionSet.id },
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 201,
          body: { request_id: requestId, questionSet },
        };
      },
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof IdempotencyError) {
      return jsonWithRequestId(
        { error: error.message },
        error.status,
        requestId,
      );
    }

    const mapped = mapQuestionSetApiError(error);

    return jsonWithRequestId(
      { error: mapped.error },
      mapped.status,
      requestId,
    );
  }
}
