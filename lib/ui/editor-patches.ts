import type { QuestionType } from "@prisma/client";

import type {
  EditableAnswer,
  EditableOption,
} from "@/lib/domain/editor-answer";

export type OfficialEditorSnapshot = {
  type: QuestionType;
  stemMd: string;
  options: EditableOption[];
  answer: EditableAnswer;
  solutionMd: string;
  knowledgePointIds: string[];
  tagIds: string[];
  difficulty: number | null;
};

export type DraftEditorSnapshot = {
  type: QuestionType | "";
  stemMd: string;
  options: EditableOption[];
  answer: EditableAnswer;
  solutionMd: string;
  knowledgePointIds: string[];
  tagIds: string[];
  difficulty: number | null;
  sourceRawAssetId?: string | null;
};

function optionIncomplete(option: EditableOption) {
  return option.label.trim().length === 0 || option.value.trim().length === 0;
}

function answerIncomplete(answer: EditableAnswer) {
  if (answer.type === "single" || answer.type === "text") {
    return answer.value.trim().length === 0;
  }

  return answer.value.length === 0;
}

export function officialSnapshotIncomplete(
  snapshot: OfficialEditorSnapshot,
  showOptions: boolean,
) {
  if (showOptions && snapshot.options.some(optionIncomplete)) {
    return true;
  }

  return answerIncomplete(snapshot.answer);
}

export function buildOfficialEditorPatch(
  snapshot: OfficialEditorSnapshot,
  showOptions: boolean,
) {
  return {
    type: snapshot.type,
    stemMd: snapshot.stemMd,
    ...(showOptions ? { options: snapshot.options } : {}),
    answer: snapshot.answer,
    solutionMd: snapshot.solutionMd,
    knowledgePointIds: snapshot.knowledgePointIds,
    tagIds: snapshot.tagIds,
    difficulty: snapshot.difficulty,
  };
}

export function buildDraftEditorPatch(
  snapshot: DraftEditorSnapshot,
  showOptions: boolean,
) {
  return {
    ...(snapshot.type ? { type: snapshot.type } : {}),
    stemMd: snapshot.stemMd,
    ...(showOptions ? { options: snapshot.options } : {}),
    answer: snapshot.answer,
    solutionMd: snapshot.solutionMd,
    knowledgePointIds: snapshot.knowledgePointIds,
    tagIds: snapshot.tagIds,
    difficulty: snapshot.difficulty,
    ...(snapshot.sourceRawAssetId
      ? { sourceRawAssetId: snapshot.sourceRawAssetId }
      : {}),
  };
}

export function buildNewQuestionDraftBody(
  snapshot: DraftEditorSnapshot,
  showOptions: boolean,
) {
  return buildDraftEditorPatch(snapshot, showOptions);
}
