import { describe, expect, it } from "vitest";

import { KNOWLEDGE_POINT_SEEDS, TAG_SEEDS } from "@/prisma/seed";

describe("seed data", () => {
  it("defines the physics knowledge point tree in parent order", () => {
    expect(KNOWLEDGE_POINT_SEEDS).toEqual([
      { slug: "physics", name: "物理", parentSlug: null, sortOrder: 0 },
      {
        slug: "physics-grade-1",
        name: "高一",
        parentSlug: "physics",
        sortOrder: 0,
      },
      {
        slug: "motion",
        name: "运动学",
        parentSlug: "physics-grade-1",
        sortOrder: 0,
      },
      {
        slug: "vt-area-displacement",
        name: "v-t 图像面积表示位移",
        parentSlug: "motion",
        sortOrder: 0,
      },
    ]);
  });

  it("defines the expected idempotent tag slugs and groups", () => {
    expect(TAG_SEEDS).toEqual([
      { slug: "image-question", name: "图像题", group: "feature" },
      { slug: "class-example", name: "课堂例题", group: "usage" },
      { slug: "in-class-practice", name: "随堂练习", group: "usage" },
      { slug: "common-mistake", name: "易错题", group: "quality" },
    ]);
  });
});
