export type TaxonomyTreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
};

export type FlattenedTaxonomyNode<T extends TaxonomyTreeNode = TaxonomyTreeNode> =
  T & { depth: number };

function compareNodes(a: TaxonomyTreeNode, b: TaxonomyTreeNode) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.name.localeCompare(b.name, "zh-CN");
}

export function flattenKnowledgePointTree<T extends TaxonomyTreeNode>(
  nodes: T[],
): FlattenedTaxonomyNode<T>[] {
  const byParent = new Map<string | null, T[]>();

  for (const node of nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort(compareNodes);
  }

  const flattened: FlattenedTaxonomyNode<T>[] = [];
  const visited = new Set<string>();

  function walk(parentId: string | null, depth: number) {
    for (const node of byParent.get(parentId) ?? []) {
      if (visited.has(node.id)) {
        continue;
      }

      visited.add(node.id);
      flattened.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  }

  walk(null, 0);

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }

    visited.add(node.id);
    flattened.push({ ...node, depth: 0 });
  }

  return flattened;
}
