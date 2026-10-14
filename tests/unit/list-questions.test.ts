import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    question: {
      findMany: mockFindMany,
    },
  },
}));

import { listQuestions } from "@/lib/domain/question-repository";

describe("listQuestions", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([]);
  });

  it("defaults to take 50", async () => {
    await listQuestions();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("forwards an explicit take", async () => {
    await listQuestions({ take: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
