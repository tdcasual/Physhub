import { describe, expect, it } from "vitest";

import {
  buildQuestionSearchWhere,
  SearchRequestValidationError,
  understandQuestionSearchQuery,
} from "@/lib/search/question-search";
import {
  mapQuestionSearchApiError,
  parseQuestionSearchRequestBody,
} from "@/app/api/search/questions/route";

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
        status: "PUBLISHED",
        difficulty: [2],
        has_image: true,
      }),
    ).toMatchObject({
      status: "PUBLISHED",
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

describe("question search route helpers", () => {
  it("accepts a valid request body", () => {
    expect(
      parseQuestionSearchRequestBody({
        query: "找 2 道高二电磁感应题",
        constraints: { status: "REVIEWED" },
      }),
    ).toEqual({
      query: "找 2 道高二电磁感应题",
      constraints: { status: "REVIEWED" },
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
});
