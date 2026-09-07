"use client";

import { useState } from "react";

import {
  QuestionList,
  type QuestionListItem,
} from "@/components/question/question-list";
import { QuestionSearchPanel } from "@/components/search/question-search-panel";
import { QuestionSetBasket } from "@/components/search/question-set-basket";

export function QuestionsWorkbench({
  questions,
}: {
  questions: QuestionListItem[];
}) {
  const [basket, setBasket] = useState<string[]>([]);

  return (
    <>
      <QuestionSearchPanel />
      <QuestionSetBasket
        questionIds={basket}
        onRemove={(id) =>
          setBasket((current) => current.filter((item) => item !== id))
        }
      />
      <QuestionList
        questions={questions}
        onAddToBasket={(id) =>
          setBasket((current) =>
            current.includes(id) ? current : [...current, id],
          )
        }
      />
    </>
  );
}
