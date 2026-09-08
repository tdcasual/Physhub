import type { KnowledgePointDto, TagDto } from "@/lib/domain/taxonomy-repository";

export const taxonomyFixtures: {
  knowledgePoints: KnowledgePointDto[];
  tags: TagDto[];
} = {
  knowledgePoints: [
    {
      id: "kp_root",
      name: "物理",
      slug: "physics",
      parentId: null,
      sortOrder: 0,
    },
    {
      id: "kp_g1",
      name: "高一",
      slug: "physics-grade-1",
      parentId: "kp_root",
      sortOrder: 0,
    },
    {
      id: "kp_motion",
      name: "运动学",
      slug: "motion",
      parentId: "kp_g1",
      sortOrder: 0,
    },
  ],
  tags: [
    {
      id: "tag_image",
      name: "图像题",
      slug: "image-question",
      group: "feature",
    },
  ],
};
