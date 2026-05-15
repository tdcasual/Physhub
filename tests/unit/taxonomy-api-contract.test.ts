import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildKnowledgePointsResponse,
  buildTagsResponse,
  listKnowledgePointsWithClient,
  listTagsWithClient,
  knowledgePointOrderBy,
  knowledgePointSelect,
  tagOrderBy,
  tagSelect,
  type KnowledgePointDto,
  type TagDto,
} from "@/lib/domain/taxonomy-repository";

const {
  mockListKnowledgePoints,
  mockListTags,
}: {
  mockListKnowledgePoints: ReturnType<typeof vi.fn>;
  mockListTags: ReturnType<typeof vi.fn>;
} = vi.hoisted(() => ({
  mockListKnowledgePoints: vi.fn(),
  mockListTags: vi.fn(),
}));

vi.mock("@/lib/domain/taxonomy-repository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/domain/taxonomy-repository")>();

  return {
    ...actual,
    listKnowledgePoints: mockListKnowledgePoints,
    listTags: mockListTags,
  };
});

describe("taxonomy repository query contracts", () => {
  it("selects stable knowledge point DTO fields and orders by sort order then name", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      knowledgePoint: { findMany },
    };

    await listKnowledgePointsWithClient(db);

    expect(knowledgePointSelect).toEqual({
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
    });
    expect(knowledgePointOrderBy).toEqual([
      { sortOrder: "asc" },
      { name: "asc" },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: knowledgePointSelect,
      orderBy: knowledgePointOrderBy,
    });
  });

  it("selects stable tag DTO fields and orders by nullable group then name", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      tag: { findMany },
    };

    await listTagsWithClient(db);

    expect(tagSelect).toEqual({
      id: true,
      name: true,
      slug: true,
      group: true,
    });
    expect(tagOrderBy).toEqual([
      { group: { sort: "asc", nulls: "last" } },
      { name: "asc" },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      select: tagSelect,
      orderBy: tagOrderBy,
    });
  });
});

describe("taxonomy API response contracts", () => {
  beforeEach(() => {
    mockListKnowledgePoints.mockReset();
    mockListTags.mockReset();
  });

  it("wraps knowledge points in the expected response shape", () => {
    const knowledgePoints: KnowledgePointDto[] = [
      {
        id: "kp_motion",
        name: "运动学",
        slug: "motion",
        parentId: null,
        sortOrder: 1,
      },
    ];

    expect(buildKnowledgePointsResponse(knowledgePoints)).toEqual({
      knowledgePoints,
    });
  });

  it("wraps tags in the expected response shape", () => {
    const tags: TagDto[] = [
      { id: "tag_exam", name: "高考", slug: "exam", group: null },
    ];

    expect(buildTagsResponse(tags)).toEqual({ tags });
  });

  it("returns knowledge points from the route", async () => {
    const knowledgePoints: KnowledgePointDto[] = [
      {
        id: "kp_motion",
        name: "运动学",
        slug: "motion",
        parentId: null,
        sortOrder: 1,
      },
    ];
    mockListKnowledgePoints.mockResolvedValue(knowledgePoints);
    const { GET } = await import("@/app/api/knowledge-points/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ knowledgePoints });
  });

  it("maps knowledge point route failures to a stable 500 JSON error", async () => {
    mockListKnowledgePoints.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("@/app/api/knowledge-points/route");

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load knowledge points",
    });
  });

  it("returns tags from the route", async () => {
    const tags: TagDto[] = [
      { id: "tag_exam", name: "高考", slug: "exam", group: "source" },
    ];
    mockListTags.mockResolvedValue(tags);
    const { GET } = await import("@/app/api/tags/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags });
  });

  it("maps tag route failures to a stable 500 JSON error", async () => {
    mockListTags.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("@/app/api/tags/route");

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load tags",
    });
  });
});
