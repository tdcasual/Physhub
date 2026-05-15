import { describe, expect, it } from "vitest";

import {
  buildKnowledgePointsResponse,
  buildTagsResponse,
} from "@/lib/domain/taxonomy-repository";
import {
  knowledgePointOrderBy,
  tagOrderBy,
} from "@/lib/domain/taxonomy-repository";

describe("taxonomy repository query contracts", () => {
  it("orders knowledge points by sort order and then name", () => {
    expect(knowledgePointOrderBy).toEqual([
      { sortOrder: "asc" },
      { name: "asc" },
    ]);
  });

  it("orders tags by nullable group and then name", () => {
    expect(tagOrderBy).toEqual([
      { group: { sort: "asc", nulls: "last" } },
      { name: "asc" },
    ]);
  });
});

describe("taxonomy API response contracts", () => {
  it("wraps knowledge points in the expected response shape", () => {
    const knowledgePoints = [{ id: "kp_motion", name: "运动学" }];

    expect(buildKnowledgePointsResponse(knowledgePoints)).toEqual({
      knowledgePoints,
    });
  });

  it("wraps tags in the expected response shape", () => {
    const tags = [{ id: "tag_exam", name: "高考", group: null }];

    expect(buildTagsResponse(tags)).toEqual({ tags });
  });
});
