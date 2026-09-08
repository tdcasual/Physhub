"use client";

import { useState } from "react";

import {
  QuestionList,
  type QuestionListItem,
} from "@/components/question/question-list";
import { QuestionSearchPanel } from "@/components/search/question-search-panel";
import {
  QuestionSetBasket,
  type BasketItem,
} from "@/components/search/question-set-basket";

function toBasketItem(item: {
  id: string;
  publicId?: string;
  question_id?: string;
  stemMd: string;
}): BasketItem {
  return {
    id: item.id,
    publicId: item.publicId ?? item.question_id ?? item.id,
    stemMd: item.stemMd,
  };
}

export function QuestionsWorkbench({
  questions,
}: {
  questions: QuestionListItem[];
}) {
  const [basket, setBasket] = useState<BasketItem[]>([]);

  function addToBasket(item: BasketItem) {
    setBasket((current) =>
      current.some((entry) => entry.id === item.id)
        ? current
        : [...current, item],
    );
  }

  return (
    <>
      <QuestionSearchPanel onAddToBasket={(item) => addToBasket(toBasketItem(item))} />
      <QuestionSetBasket
        items={basket}
        onRemove={(id) =>
          setBasket((current) => current.filter((item) => item.id !== id))
        }
      />
      <QuestionList
        questions={questions}
        onAddToBasket={(question) => addToBasket(toBasketItem(question))}
      />
    </>
  );
}
