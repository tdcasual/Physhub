export class TaxonomyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxonomyValidationError";
  }
}

export class TaxonomyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxonomyConflictError";
  }
}

export class TaxonomyNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "TaxonomyNotFoundError";
  }
}

type TaxonomyDb = typeof import("@/lib/db/prisma").prisma;

function requireNameSlug(input: unknown): { name: string; slug: string } {
  if (!input || typeof input !== "object") {
    throw new TaxonomyValidationError("name and slug are required");
  }

  const candidate = input as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const slug = typeof candidate.slug === "string" ? candidate.slug.trim() : "";

  if (!name || !slug) {
    throw new TaxonomyValidationError("name and slug are required");
  }

  return { name, slug };
}

async function countDraftsContainingJsonId(
  db: TaxonomyDb,
  field: "knowledgePointIds" | "tagIds",
  id: string,
) {
  return db.questionDraft.count({
    where: {
      [field]: {
        array_contains: [id],
      },
    },
  });
}

export async function createKnowledgePoint(input: unknown, db: TaxonomyDb) {
  const { name, slug } = requireNameSlug(input);
  const body = input as Record<string, unknown>;
  const parentId =
    typeof body.parentId === "string" && body.parentId.trim()
      ? body.parentId.trim()
      : null;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.trunc(body.sortOrder)
      : 0;

  return db.knowledgePoint.create({
    data: { name, slug, parentId, sortOrder },
  });
}

async function assertNoParentCycle(
  id: string,
  parentId: string | null,
  db: TaxonomyDb,
) {
  if (parentId == null) {
    return;
  }

  if (parentId === id) {
    throw new TaxonomyConflictError("Knowledge point parent cycle");
  }

  const seen = new Set<string>([id]);
  let current: string | null = parentId;

  while (current) {
    if (seen.has(current)) {
      throw new TaxonomyConflictError("Knowledge point parent cycle");
    }

    seen.add(current);
    const node: { parentId: string | null } | null =
      await db.knowledgePoint.findUnique({
        where: { id: current },
        select: { parentId: true },
      });

    if (!node) {
      throw new TaxonomyNotFoundError("Knowledge point not found");
    }

    current = node.parentId;
  }
}

export async function updateKnowledgePoint(
  id: string,
  input: unknown,
  db: TaxonomyDb,
) {
  const existing = await db.knowledgePoint.findUnique({ where: { id } });

  if (!existing) {
    throw new TaxonomyNotFoundError("Knowledge point not found");
  }

  const { name, slug } = requireNameSlug(input);
  const body = input as Record<string, unknown>;
  const parentIdProvided = "parentId" in body;
  const parentId = parentIdProvided
    ? typeof body.parentId === "string" && body.parentId.trim()
      ? body.parentId.trim()
      : body.parentId == null || body.parentId === ""
        ? null
        : (() => {
            throw new TaxonomyValidationError("parentId is invalid");
          })()
    : undefined;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.trunc(body.sortOrder)
      : undefined;

  if (parentIdProvided) {
    await assertNoParentCycle(id, parentId ?? null, db);
  }

  return db.knowledgePoint.update({
    where: { id },
    data: {
      name,
      slug,
      ...(parentIdProvided ? { parentId } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  });
}

export async function deleteKnowledgePoint(id: string, db: TaxonomyDb) {
  const existing = await db.knowledgePoint.findUnique({ where: { id } });

  if (!existing) {
    throw new TaxonomyNotFoundError("Knowledge point not found");
  }

  const [linkCount, primaryCount, suggestionCount, childCount, draftRefs] =
    await Promise.all([
      db.questionKnowledgePoint.count({ where: { knowledgePointId: id } }),
      db.question.count({ where: { primaryKnowledgePointId: id } }),
      db.suggestion.count({ where: { knowledgePointId: id } }),
      db.knowledgePoint.count({ where: { parentId: id } }),
      countDraftsContainingJsonId(db, "knowledgePointIds", id),
    ]);

  if (
    linkCount + primaryCount + suggestionCount + childCount + draftRefs >
    0
  ) {
    throw new TaxonomyConflictError("Knowledge point is still referenced");
  }

  return db.knowledgePoint.delete({ where: { id } });
}

export async function createTag(input: unknown, db: TaxonomyDb) {
  const { name, slug } = requireNameSlug(input);
  const body = input as Record<string, unknown>;
  const group =
    typeof body.group === "string" && body.group.trim()
      ? body.group.trim()
      : null;

  return db.tag.create({
    data: { name, slug, group },
  });
}

export async function updateTag(id: string, input: unknown, db: TaxonomyDb) {
  const existing = await db.tag.findUnique({ where: { id } });

  if (!existing) {
    throw new TaxonomyNotFoundError("Tag not found");
  }

  const { name, slug } = requireNameSlug(input);
  const body = input as Record<string, unknown>;
  const group =
    typeof body.group === "string" ? body.group.trim() || null : undefined;

  return db.tag.update({
    where: { id },
    data: {
      name,
      slug,
      ...(group !== undefined ? { group } : {}),
    },
  });
}

export async function deleteTag(id: string, db: TaxonomyDb) {
  const existing = await db.tag.findUnique({ where: { id } });

  if (!existing) {
    throw new TaxonomyNotFoundError("Tag not found");
  }

  const [linkCount, draftRefs] = await Promise.all([
    db.questionTag.count({ where: { tagId: id } }),
    countDraftsContainingJsonId(db, "tagIds", id),
  ]);

  if (linkCount + draftRefs > 0) {
    throw new TaxonomyConflictError("Tag is still referenced");
  }

  return db.tag.delete({ where: { id } });
}

export function mapTaxonomyApiError(error: unknown): {
  error: string;
  status: 400 | 404 | 409 | 500;
} {
  if (error instanceof SyntaxError) {
    return { error: "Malformed JSON request body", status: 400 };
  }

  if (error instanceof TaxonomyValidationError) {
    return { error: error.message, status: 400 };
  }

  if (error instanceof TaxonomyNotFoundError) {
    return { error: error.message, status: 404 };
  }

  if (error instanceof TaxonomyConflictError) {
    return { error: error.message, status: 409 };
  }

  return { error: "Unable to update taxonomy", status: 500 };
}
