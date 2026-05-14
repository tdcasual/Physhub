import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownLatex } from "@/lib/renderer/render-markdown";

describe("MarkdownLatex", () => {
  it("renders markdown text and latex content", () => {
    render(<MarkdownLatex content={"速度公式 $v=v_0+at$"} />);

    expect(screen.getByText(/速度公式/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });
});
