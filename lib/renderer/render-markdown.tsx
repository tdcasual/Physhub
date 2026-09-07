import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";

function isSafeImageSrc(src: string) {
  const trimmedSrc = src.trim();
  return (
    trimmedSrc.startsWith("/assets/") ||
    trimmedSrc.startsWith("/uploads/") ||
    trimmedSrc.startsWith("/api/assets/") ||
    trimmedSrc.startsWith("/api/raw-assets/")
  );
}

const markdownComponents: Components = {
  img: ({ src = "", alt = "" }) => {
    if (typeof src !== "string") {
      return null;
    }

    const safeSrc = src.trim();

    if (!isSafeImageSrc(safeSrc)) {
      return null;
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={safeSrc}
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
