import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  createQuestionDraft,
  mapDraftApiError,
} from "@/lib/domain/draft-repository";
import { parseAgentQuestionDraftInput } from "@/lib/domain/draft-schema";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";

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

  if (!agent || !hasRequiredScopes(agent.scopes, ["drafts:create"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await request.json();
    const parsed = parseAgentQuestionDraftInput(rawBody);

    if (!parsed.success) {
      return jsonWithRequestId(
        { error: parsed.message },
        400,
        requestId,
      );
    }

    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        const draft = await createQuestionDraft(parsed.data, {
          actor: "agent",
          db: tx,
        });

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "create_question_draft",
            status: "SUCCEEDED",
            input: rawBody,
            output: { draftId: draft.id },
            draftId: draft.id,
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 201,
          body: { request_id: requestId, draft },
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

    const mapped = mapDraftApiError(error);

    return jsonWithRequestId(
      { error: mapped.error },
      mapped.status,
      requestId,
    );
  }
}
