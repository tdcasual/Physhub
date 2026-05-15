import { PrismaClient } from "@prisma/client";

export const KNOWLEDGE_POINT_SEEDS = [
  { slug: "physics", name: "物理", parentSlug: null, sortOrder: 0 },
  {
    slug: "physics-grade-1",
    name: "高一",
    parentSlug: "physics",
    sortOrder: 0,
  },
  {
    slug: "motion",
    name: "运动学",
    parentSlug: "physics-grade-1",
    sortOrder: 0,
  },
  {
    slug: "vt-area-displacement",
    name: "v-t 图像面积表示位移",
    parentSlug: "motion",
    sortOrder: 0,
  },
] as const;

export const TAG_SEEDS = [
  { slug: "image-question", name: "图像题", group: "feature" },
  { slug: "class-example", name: "课堂例题", group: "usage" },
  { slug: "in-class-practice", name: "随堂练习", group: "usage" },
  { slug: "common-mistake", name: "易错题", group: "quality" },
] as const;

export async function seed(prisma: PrismaClient) {
  await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Physics Owner",
      role: "OWNER",
    },
  });

  for (const knowledgePoint of KNOWLEDGE_POINT_SEEDS) {
    const parent = knowledgePoint.parentSlug
      ? await prisma.knowledgePoint.findUniqueOrThrow({
          where: { slug: knowledgePoint.parentSlug },
          select: { id: true },
        })
      : null;

    await prisma.knowledgePoint.upsert({
      where: { slug: knowledgePoint.slug },
      update: {
        name: knowledgePoint.name,
        parentId: parent?.id ?? null,
        sortOrder: knowledgePoint.sortOrder,
      },
      create: {
        slug: knowledgePoint.slug,
        name: knowledgePoint.name,
        parentId: parent?.id ?? null,
        sortOrder: knowledgePoint.sortOrder,
      },
    });
  }

  for (const tag of TAG_SEEDS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        group: tag.group,
      },
      create: tag,
    });
  }
}

async function main() {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

const seedScriptPath = process.argv[1]?.replaceAll("\\", "/");

if (seedScriptPath?.endsWith("prisma/seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
