import { NextResponse } from "next/server";

import { requireHumanApiAuth } from "@/lib/auth/human-auth";
import { prisma } from "@/lib/db/prisma";

const suggestionReviewStatuses = [
  "accepted",
  "rejected",
  "pending_review",
] as const;

type SuggestionReviewStatus = (typeof suggestionReviewStatuses)[number];

type SuggestionRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function isSuggestionReviewStatus(
  status: unknown,
): status is SuggestionReviewStatus {
  return (
    typeof status === "string" &&
    suggestionReviewStatuses.includes(status as SuggestionReviewStatus)
  );
}

function isRequestBody(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

export async function PATCH(
  request: Request,
  context: SuggestionRouteContext,
) {
  const auth = await requireHumanApiAuth(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!isRequestBody(body)) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const { status, notes } = body;

    if (!isSuggestionReviewStatus(status)) {
      return NextResponse.json(
        { error: "Invalid suggestion status" },
        { status: 400 },
      );
    }

    const suggestion = await prisma.suggestion.findUnique({ where: { id } });

    if (!suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 },
      );
    }

    const updatedSuggestion = await prisma.$transaction(async (tx) => {
      const reviewedSuggestion = await tx.suggestion.update({
        where: { id: suggestion.id },
        data: { status },
      });

      await tx.reviewRecord.create({
        data: {
          resourceType: "suggestion",
          resourceId: suggestion.id,
          action: status,
          notes: typeof notes === "string" ? notes : undefined,
        },
      });

      return reviewedSuggestion;
    });

    return NextResponse.json({ suggestion: updatedSuggestion });
  } catch {
    return NextResponse.json(
      { error: "Failed to review suggestion" },
      { status: 500 },
    );
  }
}
