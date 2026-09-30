import type { DraftStatus, QuestionStatus, QuestionType } from "@prisma/client";

export const navLinks = [
  { href: "/drafts", label: "工作台" },
  { href: "/questions", label: "题库" },
  { href: "/questions/new", label: "录入" },
  { href: "/taxonomy", label: "知识点" },
  { href: "/agent-keys", label: "密钥" },
] as const;

export const draftStatusLabel: Record<DraftStatus, string> = {
  DRAFT: "草稿",
  NEEDS_REVIEW: "待审",
  REJECTED: "已退回",
  PROMOTED: "已入库",
};

export const questionStatusLabel: Record<QuestionStatus, string> = {
  REVIEWED: "已审定",
  PUBLISHED: "已上架",
  DEPRECATED: "已停用",
};

export const questionTypeLabel: Record<QuestionType, string> = {
  SINGLE_CHOICE: "单选",
  MULTIPLE_CHOICE: "多选",
  FILL_BLANK: "填空",
  EXPERIMENT: "实验",
  CALCULATION: "计算",
  PROOF: "证明",
  IMAGE_ANALYSIS: "读图",
};

export function labelDraftStatus(status: string) {
  return draftStatusLabel[status as DraftStatus] ?? status;
}

export function labelQuestionStatus(status: string) {
  return questionStatusLabel[status as QuestionStatus] ?? status;
}

export function labelQuestionType(type: string) {
  return questionTypeLabel[type as QuestionType] ?? type;
}

export function mapUiError(error: string) {
  if (error === "Unauthorized" || error === "帐号或密码不正确") {
    return "帐号或密码不正确";
  }

  if (error === "Unable to unlock") {
    return "暂时无法解锁，请重试";
  }

  if (error === "Forbidden") {
    return "只有编辑可以管理 Agent 密钥";
  }

  return error;
}
