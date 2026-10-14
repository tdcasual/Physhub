import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import { mapQuestionApiError } from "@/app/api/questions/route";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";
import { createQuestionByPromotingDraft } from "@/lib/domain/promote-draft";

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

  if (!agent || !hasRequiredScopes(agent.scopes, ["questions:publish"])) {
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
        const promoted = await createQuestionByPromotingDraft(rawBody, {
          db: tx,
          actorId: agent.createdById ?? undefined,
        });

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "create_official_question",
            status: "SUCCEEDED",
            input: rawBody,
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
    if (error instanceof IdempotencyError) {
      return jsonWithRequestId(
        { error: error.message },
        error.status,
        requestId,
      );
    }

    const mapped = mapQuestionApiError(error);

    return jsonWithRequestId(
      { error: mapped.error },
      mapped.status,
      requestId,
    );
  }
}
