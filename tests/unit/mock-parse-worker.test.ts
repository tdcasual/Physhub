import { describe, expect, it } from "vitest";

import { parseTextToDraft } from "@/lib/workers/mock-parse-worker";

describe("parseTextToDraft", () => {
  it("extracts a single-choice draft from pasted text", () => {
    const draft = parseTextToDraft(`下列关于力的说法正确的是？

A. 力可以改变物体的运动状态
B. 物体不接触就一定没有力
C. 力只会改变速度大小
D. 力是维持运动的原因

答案：A
解析：力是改变物体运动状态的原因。`);

    expect(draft).toEqual({
      type: "SINGLE_CHOICE",
      stemMd: "下列关于力的说法正确的是？",
      optionsJson: [
        { label: "A", value: "力可以改变物体的运动状态" },
        { label: "B", value: "物体不接触就一定没有力" },
        { label: "C", value: "力只会改变速度大小" },
        { label: "D", value: "力是维持运动的原因" },
      ],
      answerJson: { type: "single", value: "A" },
      solutionMd: "力是改变物体运动状态的原因。",
    });
  });

  it("supports Chinese option separators and keeps non-metadata lines in the stem", () => {
    const draft = parseTextToDraft(`如图所示，小球从斜面滑下。
忽略空气阻力，下列说法正确的是
A、机械能守恒
B、动能不变
答案：A`);

    expect(draft.stemMd).toBe(
      "如图所示，小球从斜面滑下。\n忽略空气阻力，下列说法正确的是",
    );
    expect(draft.optionsJson).toEqual([
      { label: "A", value: "机械能守恒" },
      { label: "B", value: "动能不变" },
    ]);
    expect(draft.answerJson).toEqual({ type: "single", value: "A" });
    expect(draft.solutionMd).toBeUndefined();
  });

  it("omits absent answer and solution fields", () => {
    const draft = parseTextToDraft(`选择正确选项
A. 甲
B. 乙`);

    expect(draft).toEqual({
      type: "SINGLE_CHOICE",
      stemMd: "选择正确选项",
      optionsJson: [
        { label: "A", value: "甲" },
        { label: "B", value: "乙" },
      ],
    });
  });

  it("keeps option-like lines in the solution after the solution marker begins", () => {
    const draft = parseTextToDraft(`选择正确选项
A. 甲
B. 乙
答案：A
解析：
A. 甲正确，因为它满足题意。
B. 乙错误，因为条件不足。`);

    expect(draft.optionsJson).toEqual([
      { label: "A", value: "甲" },
      { label: "B", value: "乙" },
    ]);
    expect(draft.solutionMd).toBe(
      "A. 甲正确，因为它满足题意。\nB. 乙错误，因为条件不足。",
    );
  });
});
