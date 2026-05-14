import { QuestionStatus, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("Prisma generated enums", () => {
  it("contains required question states and types", () => {
    expect(QuestionStatus.PUBLISHED).toBe("PUBLISHED");
    expect(QuestionType.SINGLE_CHOICE).toBe("SINGLE_CHOICE");
  });
});
