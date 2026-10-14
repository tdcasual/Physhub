import { describe, expect, it } from "vitest";

import {
  questionHasImage,
  stemHasRenderedFigure,
} from "@/lib/search/question-image";

describe("questionHasImage", () => {
  it("is true for an IMAGE source even with an empty stem", () => {
    expect(
      questionHasImage({
        sourceRawAsset: { kind: "IMAGE" },
        stemMd: "",
      }),
    ).toBe(true);
  });

  it("is false for TEXT or PDF sources without a figure", () => {
    expect(
      questionHasImage({ sourceRawAsset: { kind: "TEXT" }, stemMd: "位移" }),
    ).toBe(false);
    expect(
      questionHasImage({ sourceRawAsset: { kind: "PDF" }, stemMd: "位移" }),
    ).toBe(false);
  });

  it("is true for a local markdown image", () => {
    expect(
      stemHasRenderedFigure("![图](/api/raw-assets/raw_1/file)"),
    ).toBe(true);
  });

  it("trims whitespace destinations", () => {
    expect(
      stemHasRenderedFigure("![图]( /api/raw-assets/raw_1/file )"),
    ).toBe(true);
  });

  it("resolves reference-style images", () => {
    expect(
      stemHasRenderedFigure(
        "[图]: /api/raw-assets/raw_1/file\n\n![图]",
      ),
    ).toBe(true);
  });

  it("decodes HTML entities in the destination", () => {
    expect(
      stemHasRenderedFigure("![图](/api/raw&#45;assets/raw_1/file)"),
    ).toBe(true);
  });

  it("ignores ordinary links", () => {
    expect(
      stemHasRenderedFigure("[来源](/api/raw-assets/raw_1/file)"),
    ).toBe(false);
  });

  it("ignores mixed remote images plus a source link", () => {
    expect(
      stemHasRenderedFigure(
        "![remote](https://example.invalid/x.png) [来源](/api/raw-assets/raw_1/file)",
      ),
    ).toBe(false);
  });

  it("ignores fenced code that looks like an image", () => {
    expect(
      stemHasRenderedFigure("```\n![图](/api/raw-assets/raw_1/file)\n```"),
    ).toBe(false);
  });

  it("is false when neither source nor figure exists", () => {
    expect(questionHasImage({ stemMd: "纯文本题干" })).toBe(false);
  });
});
