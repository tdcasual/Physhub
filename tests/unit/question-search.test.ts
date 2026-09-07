import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildQuestionSearchWhere,
  SearchRequestValidationError,
  searchQuestions,
  understandQuestionSearchQuery,
} from "@/lib/search/question-search";
import {
  mapQuestionSearchApiError,
  POST,
  parseQuestionSearchRequestBody,
} from "@/app/api/search/questions/route";
import { editorSessionRequest } from "@/tests/unit/helpers/editor-session";

const findManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    question: {
      findMany: findManyMock,
    },
  },
}));

function searchableQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "question_1",
    publicId: "q_motion_0001",
    type: "SINGLE_CHOICE",
    stemMd: "高一运动学 v-t 图像面积表示位移",
    optionsJson: [{ label: "A", value: "位移" }],
    answerJson: { type: "single", value: "A" },
    solutionMd: "v-t 图像下方面积等于位移。",
    difficulty: 2,
    status: "PUBLISHED",
    sourceRawAssetId: null,
    primaryKnowledgePointId: "kp_motion",
    classificationReviewJson: null,
    usageJson: { usage: ["随堂练习"] },
    createdAt: new Date("2026-05-15T00:00:00.000Z"),
    updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    primaryKnowledgePoint: {
      id: "kp_motion",
      name: "运动学",
      parentId: null,
      createdAt: new Date("2026-05-15T00:00:00.000Z"),
      updatedAt: new Date("2026-05-15T00:00:00.000Z"),
    },
    knowledgePoints: [
      {
        questionId: "question_1",
        knowledgePointId: "kp_vt",
        knowledgePoint: {
          id: "kp_vt",
          name: "v-t 图像",
          parentId: "kp_motion",
          createdAt: new Date("2026-05-15T00:00:00.000Z"),
          updatedAt: new Date("2026-05-15T00:00:00.000Z"),
        },
      },
    ],
    tags: [
      {
        questionId: "question_1",
        tagId: "tag_class",
        tag: {
          id: "tag_class",
          name: "随堂练习",
          createdAt: new Date("2026-05-15T00:00:00.000Z"),
          updatedAt: new Date("2026-05-15T00:00:00.000Z"),
        },
      },
    ],
    assets: [
      {
        questionId: "question_1",
        assetId: "asset_1",
        asset: {
          id: "asset_1",
          kind: "IMAGE",
          storageKey: "questions/q_motion_0001.png",
          mimeType: "image/png",
          metadataJson: {},
          createdAt: new Date("2026-05-15T00:00:00.000Z"),
          updatedAt: new Date("2026-05-15T00:00:00.000Z"),
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("understandQuestionSearchQuery", () => {
  it("extracts classroom search intent from a natural Chinese query", () => {
    expect(
      understandQuestionSearchQuery(
        "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
      ),
    ).toEqual({
      rawQuery: "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
      terms: ["高一", "运动学", "v-t 图像", "位移", "随堂练习"],
      limit: 3,
      grade: "高一",
      chapter: "运动学",
      knowledge_points: ["v-t 图像", "位移"],
      difficulty: [1, 2],
      usage: ["随堂练习"],
      has_image: true,
    });
  });

  it("normalizes an empty query without inventing filters", () => {
    expect(understandQuestionSearchQuery("   ")).toEqual({
      rawQuery: "",
      terms: [],
      limit: 10,
    });
  });
});

describe("buildQuestionSearchWhere", () => {
  it("builds a Prisma where input from understanding and constraints", () => {
    const understanding = understandQuestionSearchQuery(
      "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
    );

    expect(
      buildQuestionSearchWhere(understanding, {
        status: ["PUBLISHED"],
        difficulty: [2],
        has_image: true,
      }),
    ).toMatchObject({
      status: {
        in: ["PUBLISHED"],
      },
      difficulty: {
        in: [2],
      },
      assets: {
        some: {},
      },
      AND: expect.arrayContaining([
        {
          OR: expect.arrayContaining([
            { stemMd: { contains: "v-t 图像", mode: "insensitive" } },
            { solutionMd: { contains: "位移", mode: "insensitive" } },
          ]),
        },
        {
          OR: expect.arrayContaining([
            {
              primaryKnowledgePoint: {
                name: { contains: "运动学", mode: "insensitive" },
              },
            },
          ]),
        },
        {
          OR: expect.arrayContaining([
            {
              usageJson: {
                path: ["usage"],
                array_contains: "随堂练习",
              },
            },
          ]),
        },
      ]),
    });
  });
});

describe("searchQuestions", () => {
  it("returns query understanding and repository results without a live database", async () => {
    const question = searchableQuestion();
    findManyMock.mockResolvedValueOnce([question]);

    const result = await searchQuestions(
      "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
      { status: ["PUBLISHED"] },
    );

    expect(findManyMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: { in: ["PUBLISHED"] },
        difficulty: { in: [1, 2] },
        assets: { some: {} },
      }),
      select: expect.objectContaining({
        id: true,
        publicId: true,
        type: true,
        status: true,
        stemMd: true,
      }),
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });
    expect(result).toEqual({
      understanding: {
        rawQuery:
          "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
        terms: ["高一", "运动学", "v-t 图像", "位移", "随堂练习"],
        limit: 3,
        grade: "高一",
        chapter: "运动学",
        knowledge_points: ["v-t 图像", "位移"],
        difficulty: [1, 2],
        usage: ["随堂练习"],
        has_image: true,
      },
      results: [
        {
          id: "question_1",
          question_id: "q_motion_0001",
          score: expect.any(Number),
          reason: expect.any(String),
          stemMd: question.stemMd,
          status: "PUBLISHED",
          type: "SINGLE_CHOICE",
          reasons: expect.arrayContaining([
            { field: "text", value: "高一" },
            { field: "text", value: "运动学" },
            { field: "difficulty", value: "2" },
            { field: "assets", value: "has_image" },
          ]),
        },
      ],
    });
  });
});

describe("question search route helpers", () => {
  it("accepts a valid request body", () => {
    expect(
      parseQuestionSearchRequestBody({
        query: "找 2 道高二电磁感应题",
        constraints: { status: ["reviewed", "PUBLISHED"] },
      }),
    ).toEqual({
      query: "找 2 道高二电磁感应题",
      constraints: { status: ["REVIEWED", "PUBLISHED"] },
    });
  });

  it("rejects malformed request bodies with stable 400 errors", () => {
    expect(() => parseQuestionSearchRequestBody(null)).toThrow(
      SearchRequestValidationError,
    );
    expect(() => parseQuestionSearchRequestBody({ query: 42 })).toThrow(
      SearchRequestValidationError,
    );
    expect(mapQuestionSearchApiError(new SyntaxError("bad"))).toEqual({
      error: "Malformed JSON request body",
      status: 400,
    });
    expect(
      mapQuestionSearchApiError(
        new SearchRequestValidationError("Search query is required"),
      ),
    ).toEqual({
      error: "Search query is required",
      status: 400,
    });
  });

  it("rejects malformed nested constraints with stable 400 errors", () => {
    for (const body of [
      { query: "找题", constraints: [] },
      { query: "找题", constraints: { knowledge_points: "运动学" } },
      { query: "找题", constraints: { usage: [42] } },
      { query: "找题", constraints: { difficulty: ["easy"] } },
      { query: "找题", constraints: { has_image: "yes" } },
    ]) {
      expect(() => parseQuestionSearchRequestBody(body)).toThrow(
        SearchRequestValidationError,
      );
    }
  });

  it("rejects invalid status constraints with stable 400 errors", () => {
    expect(() =>
      parseQuestionSearchRequestBody({
        query: "找题",
        constraints: { status: ["published", "DRAFT"] },
      }),
    ).toThrow(SearchRequestValidationError);
  });
});

describe("POST /api/search/questions", () => {
  it("accepts a query with optional constraints and returns the search result", async () => {
    findManyMock.mockResolvedValueOnce([searchableQuestion()]);

    const response = await POST(
      editorSessionRequest("http://localhost/api/search/questions", {
        method: "POST",
        body: JSON.stringify({
          query: "找 2 道高二电磁感应题",
          constraints: { limit: 1, status: ["reviewed"] },
        }),
      }),
    );

    const json = await response.json();

    expect(json).toMatchObject({
      understanding: {
        rawQuery: "找 2 道高二电磁感应题",
        terms: ["高二", "电磁感应"],
        limit: 1,
        grade: "高二",
        chapter: "电磁感应",
      },
      results: [
        {
          id: "question_1",
          question_id: "q_motion_0001",
          reasons: expect.any(Array),
        },
      ],
    });
    expect(json.results[0]).not.toHaveProperty("answerJson");
    expect(json.results[0]).not.toHaveProperty("metadata");
    expect(json.results[0]).not.toHaveProperty("usageJson");
    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        where: expect.objectContaining({
          status: { in: ["REVIEWED"] },
        }),
      }),
    );
  });

  it("returns stable 400 responses for malformed nested constraints", async () => {
    const response = await POST(
      editorSessionRequest("http://localhost/api/search/questions", {
        method: "POST",
        body: JSON.stringify({
          query: "找题",
          constraints: { knowledge_points: [null] },
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: expect.any(String),
    });
    expect(response.status).toBe(400);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns stable 500 responses for database failures", async () => {
    findManyMock.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(
      editorSessionRequest("http://localhost/api/search/questions", {
        method: "POST",
        body: JSON.stringify({
          query: "找题",
          constraints: { status: ["PUBLISHED"] },
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Unable to search questions",
    });
    expect(response.status).toBe(500);
  });
});
