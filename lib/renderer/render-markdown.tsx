import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";

function isSafeImageSrc(src: string) {
  if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../")) {
    return true;
  }

  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const markdownComponents: Components = {
  img: ({ src = "", alt = "" }) => {
    if (typeof src !== "string") {
      return null;
    }

    if (!isSafeImageSrc(src)) {
      return null;
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="max-w-full rounded border border-slate-200"
      />
    );
  },
};

export function MarkdownLatex({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeSanitize, rehypeKatex]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
