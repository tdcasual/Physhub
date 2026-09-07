import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { hasRequiredScopes, readAgentAuth } from "@/lib/auth/agent-auth";
import {
  IdempotencyError,
  idempotencyApiKeyId,
  parseIdempotencyKey,
  readRequestId,
  withJsonIdempotency,
} from "@/lib/domain/idempotency";

class SuggestionSubmitError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SuggestionSubmitError";
    this.status = status;
  }
}

function jsonWithRequestId(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providedId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseSubmitBody(body: unknown): {
  draftId?: string;
  questionId?: string;
  kind: string;
  confidence?: number;
  payload: Prisma.InputJsonValue;
} {
  if (!isRecord(body)) {
    throw new SuggestionSubmitError("Invalid request body", 400);
  }

  const draftId = providedId(body.draftId);
  const questionId = providedId(body.questionId);

  if ((draftId == null) === (questionId == null)) {
    throw new SuggestionSubmitError(
      "Provide exactly one of draftId or questionId",
      400,
    );
  }

  const kind =
    body.kind === undefined || body.kind === null || body.kind === ""
      ? "metadata"
      : body.kind;

  if (kind !== "metadata") {
    throw new SuggestionSubmitError("Invalid suggestion kind", 400);
  }

  if (!isRecord(body.payload)) {
    throw new SuggestionSubmitError("Invalid request body", 400);
  }

  return {
    draftId,
    questionId,
    kind,
    confidence:
      typeof body.confidence === "number" ? body.confidence : undefined,
    payload: body.payload as Prisma.InputJsonValue,
  };
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["suggestions:create"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await request.json();
    const parsed = parseSubmitBody(rawBody);

    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        const draftId = parsed.draftId ?? null;
        let questionId = parsed.questionId ?? null;

        if (draftId) {
          const draft = await tx.questionDraft.findUnique({
            where: { id: draftId },
            select: {
              id: true,
              status: true,
              promotedQuestionId: true,
            },
          });

          if (!draft) {
            throw new SuggestionSubmitError("Draft not found", 422);
          }

          if (draft.status === "PROMOTED") {
            if (!draft.promotedQuestionId) {
              throw new SuggestionSubmitError("Draft is not updatable", 409);
            }

            questionId = draft.promotedQuestionId;
          } else if (draft.status === "REJECTED") {
            throw new SuggestionSubmitError("Draft is not updatable", 409);
          }
        }

        if (questionId) {
          const question = await tx.question.findUnique({
            where: { id: questionId },
            select: { id: true },
          });

          if (!question) {
            throw new SuggestionSubmitError("Question not found", 422);
          }
        }

        const agentRun = await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "submit_suggestions",
            status: "SUCCEEDED",
            input: rawBody as Prisma.InputJsonValue,
            output: {},
            draftId,
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        const suggestion = await tx.suggestion.create({
          data: {
            draftId,
            questionId,
            kind: parsed.kind,
            payload: parsed.payload,
            confidence: parsed.confidence,
            status: "pending_review",
            createdByAgentRunId: agentRun.id,
          },
        });

        await tx.agentRun.update({
          where: { id: agentRun.id },
          data: {
            output: { suggestionId: suggestion.id },
          },
        });

        return {
          status: 201,
          body: { request_id: requestId, suggestion },
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

    if (error instanceof SuggestionSubmitError) {
      return jsonWithRequestId(
        { error: error.message },
        error.status,
        requestId,
      );
    }

    if (error instanceof SyntaxError) {
      return jsonWithRequestId(
        { error: "Malformed JSON request body" },
        400,
        requestId,
      );
    }

    return jsonWithRequestId(
      { error: "Unable to submit suggestions" },
      500,
      requestId,
    );
  }
}
