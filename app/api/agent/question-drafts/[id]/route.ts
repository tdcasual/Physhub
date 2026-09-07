import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  getQuestionDraft,
  mapDraftApiError,
  updateQuestionDraft,
} from "@/lib/domain/draft-repository";
import { parseAgentQuestionDraftInput } from "@/lib/domain/draft-schema";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";

type AgentQuestionDraftRouteContext = {
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

export async function GET(
  request: Request,
  context: AgentQuestionDraftRouteContext,
) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["drafts:read"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  const { id } = await context.params;

  try {
    const draft = await getQuestionDraft(id);

    if (!draft) {
      return jsonWithRequestId({ error: "Draft not found" }, 404, requestId);
    }

    return NextResponse.json({ draft });
  } catch {
    return jsonWithRequestId(
      { error: "Failed to load question draft" },
      500,
      requestId,
    );
  }
}

export async function PATCH(
  request: Request,
  context: AgentQuestionDraftRouteContext,
) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["drafts:update"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  const { id } = await context.params;

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
      method: "PATCH",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        const draft = await updateQuestionDraft(id, parsed.data, {
          actor: "agent",
          db: tx,
        });

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "update_question_draft",
            status: "SUCCEEDED",
            input: rawBody,
            output: { draftId: draft.id, status: draft.status },
            draftId: draft.id,
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 200,
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
