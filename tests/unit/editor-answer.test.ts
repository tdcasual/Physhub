import { describe, expect, it } from "vitest";

import {
  defaultAnswerForType,
  optionsAfterTypeChange,
  parseEditableAnswer,
  parseIdArray,
} from "@/lib/domain/editor-answer";

describe("editor answer helpers", () => {
  it("promotes a single answer into a multiple-choice list", () => {
    expect(
      defaultAnswerForType("MULTIPLE_CHOICE", [{ label: "A" }], {
        type: "single",
        value: "B",
      }),
    ).toEqual({ type: "multiple", value: ["B"] });
  });

  it("takes the first multiple value when switching back to single", () => {
    expect(
      defaultAnswerForType("SINGLE_CHOICE", [{ label: "A" }], {
        type: "multiple",
        value: ["C", "D"],
      }),
    ).toEqual({ type: "single", value: "C" });
  });

  it("uses a text answer for non-choice types", () => {
    expect(defaultAnswerForType("CALCULATION", [])).toEqual({
      type: "text",
      value: "",
    });
  });

  it("restores default options when switching from text to a choice type", () => {
    const options = optionsAfterTypeChange("SINGLE_CHOICE", []);
    expect(options.map((option) => option.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("parses id arrays and editable answers", () => {
    expect(parseIdArray(["kp_1", "", 3, "kp_2"])).toEqual(["kp_1", "kp_2"]);
    expect(parseEditableAnswer({ type: "multiple", value: ["A", "B"] })).toEqual({
      type: "multiple",
      value: ["A", "B"],
    });
    expect(parseEditableAnswer({ type: "text", value: "42 m/s" })).toEqual({
      type: "text",
      value: "42 m/s",
    });
  });
});
