export type SuggestionWriteActor = "agent" | "human";

export type SuggestionWritePolicyInput = {
  actor: SuggestionWriteActor;
  kind: string;
};

export function canSuggestionWriteDirectlyToQuestion(
  input: SuggestionWritePolicyInput,
) {
  return input.actor === "human";
}
