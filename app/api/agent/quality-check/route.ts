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
  validatePublishableQuestion,
  type QuestionInput,
} from "@/lib/domain/question-schema";

function jsonWithRequestId(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
) {
  return NextResponse.json({ request_id: requestId, ...body }, { status });
}

class QualityCheckError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "QualityCheckError";
    this.status = status;
  }
}

function isOmitted(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function parseQualityCheckBody(body: unknown): {
  draftId?: string;
  question?: Record<string, unknown>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new QualityCheckError("Request body must be an object", 400);
  }

  const record = body as Record<string, unknown>;
  const draftIdValue = record.draftId;
  const draftId =
    typeof draftIdValue === "string" && draftIdValue.trim().length > 0
      ? draftIdValue.trim()
      : undefined;
  const question = isOmitted(record.question) ? undefined : record.question;
  const hasDraftId = draftId !== undefined;
  const hasQuestion = question !== undefined;

  if (hasDraftId === hasQuestion) {
    throw new QualityCheckError(
      "Provide exactly one of draftId or question",
      400,
    );
  }

  if (hasQuestion) {
    if (typeof question !== "object" || question === null || Array.isArray(question)) {
      throw new QualityCheckError("question must be an object", 400);
    }

    return { question: question as Record<string, unknown> };
  }

  return { draftId };
}

function asPartialQuestionInput(
  value: Record<string, unknown>,
): Partial<QuestionInput> {
  return value as Partial<QuestionInput>;
}

function questionInputFromDraft(draft: {
  type: QuestionInput["type"] | null;
  stemMd: string | null;
  optionsJson: unknown;
  answerJson: unknown;
  solutionMd: string | null;
  difficulty: number | null;
  knowledgePointIds: unknown;
}): Partial<QuestionInput> {
  return {
    ...(draft.type ? { type: draft.type } : {}),
    ...(draft.stemMd != null ? { stemMd: draft.stemMd } : {}),
    ...(Array.isArray(draft.optionsJson)
      ? { options: draft.optionsJson as QuestionInput["options"] }
      : {}),
    ...(draft.answerJson &&
    typeof draft.answerJson === "object" &&
    !Array.isArray(draft.answerJson)
      ? { answer: draft.answerJson as QuestionInput["answer"] }
      : {}),
    ...(draft.solutionMd != null ? { solutionMd: draft.solutionMd } : {}),
    ...(draft.difficulty != null ? { difficulty: draft.difficulty } : {}),
    ...(Array.isArray(draft.knowledgePointIds)
      ? {
          knowledgePointIds: draft.knowledgePointIds.filter(
            (id): id is string => typeof id === "string",
          ),
        }
      : {}),
  };
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  const agent = await readAgentAuth(request);

  if (!agent || !hasRequiredScopes(agent.scopes, ["quality:check"])) {
    return jsonWithRequestId({ error: "Unauthorized" }, 401, requestId);
  }

  try {
    const key = parseIdempotencyKey(request);
    const rawBody = await request.json();
    const parsed = parseQualityCheckBody(rawBody);

    const result = await withJsonIdempotency({
      apiKeyId: idempotencyApiKeyId(agent.apiKeyId),
      key,
      method: "POST",
      path: new URL(request.url).pathname,
      body: rawBody,
      execute: async (tx) => {
        let input: Partial<QuestionInput>;
        let draftId: string | undefined;

        if (parsed.draftId) {
          const draft = await tx.questionDraft.findUnique({
            where: { id: parsed.draftId },
          });

          if (!draft) {
            throw new QualityCheckError("Draft not found", 422);
          }

          input = questionInputFromDraft(draft);
          draftId = draft.id;
        } else {
          input = asPartialQuestionInput(parsed.question ?? {});
        }

        const errors = validatePublishableQuestion(input);
        const output = {
          publishable: errors.length === 0,
          errors,
        };

        await tx.agentRun.create({
          data: {
            agentName: agent.name,
            toolName: "check_question_quality",
            status: "SUCCEEDED",
            input: rawBody,
            output,
            draftId,
            apiKeyId: agent.apiKeyId,
            requestId,
          },
        });

        return {
          status: 200,
          body: { request_id: requestId, ...output },
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

    if (error instanceof QualityCheckError) {
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
      { error: "Unable to check question quality" },
      500,
      requestId,
    );
  }
}
