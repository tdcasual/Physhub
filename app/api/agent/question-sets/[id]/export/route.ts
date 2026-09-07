import { NextResponse } from "next/server";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  createQuestionSetExport,
  mapQuestionSetExportApiError,
  parseExportBody,
  readJsonBody,
} from "@/lib/domain/question-set-export";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";

type AgentQuestionSetExportRouteContext = {
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

export async function POST(
  request: Request,
  context: AgentQuestionSetExportRouteContext,
) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["exports:create"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  const { id } = await context.params;

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await readJsonBody(request);
    const body = parseExportBody(rawBody);
    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody ?? {},
      execute: async (tx) => {
        const exported = await createQuestionSetExport(id, body, tx);

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "export_question_set",
            status: "SUCCEEDED",
            input: {
              questionSetId: id,
              format: body.format,
              teacher: body.teacher,
            },
            output: { exportJobId: exported.exportJob.id },
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 200,
          body: { request_id: requestId, ...exported },
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

    const mapped = mapQuestionSetExportApiError(error);

    return jsonWithRequestId(
      { error: mapped.error },
      mapped.status,
      requestId,
    );
  }
}
