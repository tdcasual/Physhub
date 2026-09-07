import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownLatex } from "@/lib/renderer/render-markdown";

describe("MarkdownLatex", () => {
  it("renders markdown text and latex content", () => {
    render(<MarkdownLatex content={"速度公式 $v=v_0+at$"} />);

    expect(screen.getByText(/速度公式/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });

  it("keeps raw HTML script and event handler content inert", () => {
    const { container } = render(
      <MarkdownLatex
        content={
          '<script>alert("xss")</script><img src="/assets/test.png" onerror="alert(1)" alt="Injected image" />'
        }
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//evil.example/image.png",
    "http://evil.example/image.png",
    "https://evil.example/image.png",
  ])("blocks unsafe markdown image source %s", (src) => {
    const { container } = render(
      <MarkdownLatex content={`![Unsafe image](${src})`} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("renders allowed local asset image paths with alt text", () => {
    render(<MarkdownLatex content="![Experiment diagram](/assets/diagram.png)" />);

    const image = screen.getByRole("img", { name: "Experiment diagram" });
    expect(image).toHaveAttribute("src", "/assets/diagram.png");
  });

  it("renders authenticated raw asset file paths", () => {
    render(
      <MarkdownLatex content="![Source scan](/api/raw-assets/raw_1/file)" />,
    );

    expect(screen.getByRole("img", { name: "Source scan" })).toHaveAttribute(
      "src",
      "/api/raw-assets/raw_1/file",
    );
  });
});
