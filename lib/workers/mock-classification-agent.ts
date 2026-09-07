// Rule fixture for tests / ENABLE_MOCK_CLASSIFY, not an LLM.
// Payload has no knowledge_points[].id, so human accept cannot write it.
export type MetadataSuggestion = {
  knowledge_points: Array<{
    value: string;
    confidence: number;
    reason: string;
  }>;
  difficulty: {
    value: number;
    confidence: number;
    reason: string;
  };
  risks: string[];
};

export function suggestMetadata(stemMd: string): MetadataSuggestion {
  const hasVt = /(?:\bv[\s-]*t\b)|速度\s*[-—－]?\s*时间/u.test(stemMd);

  if (hasVt) {
    return {
      knowledge_points: [
        {
          value: "v-t 图像面积表示位移",
          confidence: 0.86,
          reason: "题干出现速度-时间图像相关表述",
        },
      ],
      difficulty: {
        value: 2,
        confidence: 0.72,
        reason: "基础概念应用，计算量较低",
      },
      risks: [],
    };
  }

  return {
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
  };
}
