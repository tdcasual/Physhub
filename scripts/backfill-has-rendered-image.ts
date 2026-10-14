import { prisma } from "@/lib/db/prisma";
import { questionHasImage } from "@/lib/search/question-image";

async function main() {
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      stemMd: true,
      sourceRawAsset: {
        select: { kind: true },
      },
    },
  });

  for (const question of questions) {
    const hasRenderedImage = questionHasImage({
      sourceRawAsset: question.sourceRawAsset,
      stemMd: question.stemMd,
    });

    await prisma.question.update({
      where: { id: question.id },
      data: { hasRenderedImage },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
