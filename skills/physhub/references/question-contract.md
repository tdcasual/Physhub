# Question / draft JSON contract

This is the home of `answer.value` facts. Draft create/update and quality-check `question` bodies use these shapes. Persisted drafts store `options` as `optionsJson` and `answer` as `answerJson`.

## Types

`type` (Prisma `QuestionType`): `SINGLE_CHOICE` | `MULTIPLE_CHOICE` | `FILL_BLANK` | `EXPERIMENT` | `CALCULATION` | `PROOF` | `IMAGE_ANALYSIS`.

Choice types: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`.

Draft create/update: every field optional; incomplete drafts are valid. Promote / quality-check `publishable` uses `validatePublishableQuestion` below.

Draft/write fields:

| Field | Notes |
| --- | --- |
| `type` | enum above |
| `stemMd` | markdown + `$…$` / `$$…$$` LaTeX |
| `options` | `{ label, value }[]` |
| `answer` | discriminated union below |
| `solutionMd` | optional |
| `difficulty` | int 1–5 |
| `knowledgePointIds` | ids from `GET /api/agent/knowledge-points` |
| `tagIds` | ids from `GET /api/agent/tags` |
| `sourceRawAssetId` | id from `POST /api/agent/raw-assets` |
| `status` | agent PATCH only: `"NEEDS_REVIEW"` |

## `optionSchema`

```ts
{ label: string /* trimmed, min 1 */, value: string /* trimmed, min 1 */ }
```

- `label`: the choice key (`A`, `B`, `C`, `D`).
- `value`: the option text shown to students. Not the answer.

Create/update normalize labels with `trim` + uppercase (`" b "` → `"B"`). Option text is trimmed, not uppercased.

## `answerSchema`

Discriminated on `type`:

```ts
{ type: "single", value: string }          // one option label
{ type: "multiple", value: string[] }     // one or more option labels
{ type: "text", value: string }           // non-choice
```

### Label rule (choice questions)

`answer.value` is the option **label**, not `options[].value`.

```json
{
  "type": "SINGLE_CHOICE",
  "options": [
    { "label": "A", "value": "物体一直做匀速直线运动" },
    { "label": "B", "value": "物体先做匀加速运动，后做匀速运动" }
  ],
  "answer": { "type": "single", "value": "B" }
}
```

Wrong: `"answer": { "type": "single", "value": "物体先做匀加速运动，后做匀速运动" }` → quality-check / promote `答案必须匹配选项`.

`SINGLE_CHOICE` ↔ `answer.type: "single"`. `MULTIPLE_CHOICE` ↔ `answer.type: "multiple"`. Mismatch → `答案必须匹配选项`.

Normalize (when `answer` and/or `options` are present on create and on update):

- single: `answer.value` trimmed and uppercased (`" b "` → `"B"`).
- multiple: each entry trimmed and uppercased.
- text: trimmed only, not uppercased.

Matching is against `options[].label` after that normalize.

## `validatePublishableQuestion`

Returns unique Chinese strings (order below). Used by quality-check; does not write a `Question`.

| When | `error` |
| --- | --- |
| `stemMd` missing / blank | `题干不能为空` |
| `type` missing | `必须确认题型` |
| answer missing / blank | `必须填写答案` |
| no non-blank `knowledgePointIds` | `必须确认知识点` |
| choice type and no `options` | `选择题必须有选项` |
| answer type ≠ question type, or a choice value is not an option label | `答案必须匹配选项` |

`publishable: true` iff this list is empty.
