import { describe, expect, it } from "vitest";

import { suggestMetadata } from "@/lib/workers/mock-classification-agent";

describe("mock classification agent", () => {
  it("suggests v-t graph knowledge point from Chinese stem", () => {
    const result = suggestMetadata("速度-时间图像的面积表示什么？");

    expect(result.knowledge_points).toHaveLength(1);
    expect(result.knowledge_points[0]).toMatchObject({
      value: expect.stringContaining("v-t"),
      confidence: 0.86,
      reason: expect.any(String),
    });
    expect(result.knowledge_points[0]).not.toHaveProperty("id");
    expect(result.difficulty).toMatchObject({
      value: 2,
      confidence: 0.72,
      reason: expect.any(String),
    });
    expect(result.risks).toEqual([]);
  });

  it("suggests v-t graph knowledge point from v-t notation", () => {
    const result = suggestMetadata("如图为小车运动的 v-t 图像。");

    expect(result.knowledge_points[0].value).toContain("v-t");
    expect(result.difficulty.value).toBe(2);
  });

  it("returns low-confidence placeholder metadata when no rule matches", () => {
    const result = suggestMetadata("弹簧振子的周期与哪些因素有关？");

    expect(result).toEqual({
      knowledge_points: [
        {
          value: "待人工确认",
          confidence: 0.35,
          reason: "规则无法稳定识别知识点",
        },
      ],
      difficulty: {
        value: 3,
        confidence: 0.4,
        reason: "需要人工确认难度",
      },
      risks: ["知识点置信度较低，请人工确认"],
    });
  });
});
