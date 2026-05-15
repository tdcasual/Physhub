import { NextResponse } from "next/server";

import {
  QuestionSearchPersistenceError,
  SearchRequestValidationError,
  searchQuestions,
  type QuestionSearchConstraints,
} from "@/lib/search/question-search";

export type QuestionSearchApiErrorResponse = {
  error: string;
  status: 400 | 500;
};

type QuestionSearchRequestBody = {
  query: string;
  constraints?: QuestionSearchConstraints;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseQuestionSearchRequestBody(
  body: unknown,
): QuestionSearchRequestBody {
  if (!isObject(body)) {
    throw new SearchRequestValidationError("Request body must be an object");
  }

  if (typeof body.query !== "string" || body.query.trim().length === 0) {
    throw new SearchRequestValidationError("Search query is required");
  }

  if (
    body.constraints !== undefined &&
    !isObject(body.constraints)
  ) {
    throw new SearchRequestValidationError("Search constraints must be an object");
  }

  return {
    query: body.query,
    ...(body.constraints
      ? { constraints: body.constraints as QuestionSearchConstraints }
      : {}),
  };
}

export function mapQuestionSearchApiError(
  error: unknown,
): QuestionSearchApiErrorResponse {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof SearchRequestValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof QuestionSearchPersistenceError) {
    return { error: error.message, status: 500 };
  }

  return { error: "Unable to search questions", status: 500 };
}

export async function POST(request: Request) {
  try {
    const body = parseQuestionSearchRequestBody(await request.json());
    const result = await searchQuestions(body.query, body.constraints);

    return NextResponse.json(result);
  } catch (error) {
    const response = mapQuestionSearchApiError(error);

    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
}
