import { describe, expect, it } from "vitest";

import { flattenKnowledgePointTree } from "@/lib/domain/taxonomy-tree";

describe("flattenKnowledgePointTree", () => {
  it("orders children under parents and assigns depth", () => {
    const flattened = flattenKnowledgePointTree([
      { id: "child", name: "运动学", slug: "motion", parentId: "root", sortOrder: 0 },
      { id: "root", name: "物理", slug: "physics", parentId: null, sortOrder: 0 },
      { id: "leaf", name: "位移", slug: "displacement", parentId: "child", sortOrder: 0 },
    ]);

    expect(flattened.map((node) => [node.name, node.depth])).toEqual([
      ["物理", 0],
      ["运动学", 1],
      ["位移", 2],
    ]);
  });

  it("does not loop when a parent cycle is present", () => {
    const flattened = flattenKnowledgePointTree([
      { id: "a", name: "A", slug: "a", parentId: "b", sortOrder: 0 },
      { id: "b", name: "B", slug: "b", parentId: "a", sortOrder: 0 },
    ]);

    expect(flattened).toHaveLength(2);
    expect(new Set(flattened.map((node) => node.id))).toEqual(new Set(["a", "b"]));
  });
});
