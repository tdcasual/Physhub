import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

import {
  isLocalRawAssetImageUrl,
  isSafeImageSrc,
} from "@/lib/renderer/safe-image-src";

type MdastParent = { type?: string } | null | undefined;

function isCodeLike(node: { type?: string } | null | undefined) {
  return node?.type === "code" || node?.type === "inlineCode";
}

function urlIsRenderedLocalFigure(url: string | null | undefined) {
  if (typeof url !== "string") {
    return false;
  }

  const trimmed = url.trim();
  return isSafeImageSrc(trimmed) && isLocalRawAssetImageUrl(trimmed);
}

export function stemHasRenderedFigure(stemMd: string | null | undefined): boolean {
  if (!stemMd) {
    return false;
  }

  const tree = unified().use(remarkParse).use(remarkMath).parse(stemMd);
  const definitions = new Map<string, string>();

  visit(tree, "definition", (node) => {
    const definition = node as { identifier?: string; url?: string };

    if (
      typeof definition.identifier === "string" &&
      typeof definition.url === "string"
    ) {
      definitions.set(definition.identifier, definition.url);
    }
  });

  let found = false;

  visit(tree, (node, _index, parent: MdastParent) => {
    if (isCodeLike(node)) {
      return SKIP;
    }

    if (isCodeLike(parent)) {
      return SKIP;
    }

    if (node.type === "image") {
      const image = node as { url?: string };

      if (urlIsRenderedLocalFigure(image.url)) {
        found = true;
        return SKIP;
      }
    }

    if (node.type === "imageReference") {
      const imageRef = node as { identifier?: string };
      const url =
        typeof imageRef.identifier === "string"
          ? definitions.get(imageRef.identifier)
          : undefined;

      if (urlIsRenderedLocalFigure(url)) {
        found = true;
        return SKIP;
      }
    }

    return undefined;
  });

  return found;
}

export function questionHasImage(q: {
  sourceRawAsset?: { kind: string } | null;
  stemMd?: string | null;
}): boolean {
  return q.sourceRawAsset?.kind === "IMAGE" || stemHasRenderedFigure(q.stemMd);
}
