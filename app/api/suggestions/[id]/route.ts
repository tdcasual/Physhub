import { NextResponse } from "next/server";

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

export async function PATCH(
  request: Request,
  context: SuggestionRouteContext,
) {
  const { id } = await context.params;

  try {
    const body = await request.json();

    if (!isSuggestionReviewStatus(body.status)) {
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
        data: { status: body.status },
      });

      await tx.reviewRecord.create({
        data: {
          resourceType: "suggestion",
          resourceId: suggestion.id,
          action: body.status,
          notes: typeof body.notes === "string" ? body.notes : undefined,
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
