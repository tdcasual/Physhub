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

export const suggestionStatusLabel: Record<string, string> = {
  pending_review: "待处理",
  accepted: "已接受",
  rejected: "已不用",
};

export const jobStatusLabel: Record<string, string> = {
  QUEUED: "排队",
  RUNNING: "进行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELED: "已取消",
  RETRYING: "重试中",
};

export const rawAssetKindLabel: Record<string, string> = {
  IMAGE: "图片",
  PDF: "PDF",
  MARKDOWN: "Markdown",
  LATEX: "LaTeX",
  TEXT: "文本",
};

export const rawAssetStatusLabel: Record<string, string> = {
  UPLOADED: "已上传",
  PROCESSING: "处理中",
  PARSED: "已解析",
  FAILED: "失败",
  ARCHIVED: "已归档",
};

export function labelSuggestionStatus(status: string) {
  return suggestionStatusLabel[status] ?? status.replaceAll("_", " ");
}

export function labelJobStatus(status: string) {
  return jobStatusLabel[status] ?? status;
}

export function labelRawAssetKind(kind: string) {
  return rawAssetKindLabel[kind] ?? kind;
}

export function labelRawAssetStatus(status: string) {
  return rawAssetStatusLabel[status] ?? status;
}

export function mapUiError(error: string) {
  if (error === "Unauthorized" || error === "帐号或密码不正确") {
    return "帐号或密码不正确";
  }

  if (error === "Unable to unlock") {
    return "暂时无法解锁，请重试";
  }

  if (error === "Too many unlock attempts") {
    return "尝试次数过多，请稍后再试";
  }

  if (error === "Forbidden") {
    return "没有权限做这项操作";
  }

  if (
    error === "Unable to update draft" ||
    error === "Unable to save draft"
  ) {
    return "无法保存草稿";
  }

  if (error === "Search query is required") {
    return "请先输入要找的内容。";
  }

  if (error === "Unable to search questions") {
    return "无法检索试题";
  }

  if (error === "Unable to create question set") {
    return "无法创建试卷";
  }

  if (error === "Unable to export question set") {
    return "无法导出";
  }

  if (error === "Export requires PUBLISHED questions") {
    return "导出需要已上架试题";
  }

  if (error === "name and slug are required") {
    return "需要填写名称和 slug";
  }

  if (error === "Knowledge point is still referenced") {
    return "还有试题在用这个知识点";
  }

  if (error === "Tag is still referenced") {
    return "还有试题在用这个标签";
  }

  if (error === "Unable to update taxonomy") {
    return "无法更新知识点";
  }

  if (error === "Slug already exists") {
    return "这个 slug 已经存在";
  }

  if (error === "Unsupported media type") {
    return "不支持这种文件";
  }

  if (error === "File too large") {
    return "文件太大";
  }

  if (error === "Unable to create raw asset") {
    return "无法上传来源";
  }

  if (error === "Draft is not promotable") {
    return "这份草稿还不能入库";
  }

  if (error === "Unable to promote draft") {
    return "无法入库";
  }

  if (error === "Invalid request body") {
    return "请求内容不正确";
  }

  if (error === "Suggestions cannot be applied to a closed draft") {
    return "已入库或已退回的草稿不能再接受建议";
  }

  return error;
}
