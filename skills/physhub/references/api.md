# Agent Tool API

Prefix: `/api/agent`. Auth failure or missing scope → `401` `{ "error": "Unauthorized" }`.

Mutating JSON successes (and errors, once a request id is known) include `"request_id"`. Optional header `X-Request-Id`; otherwise the server generates a UUID. Existing search / get-question / list routes do not add `request_id`.

## Headers

| Header | Mutating | Read (`search` / `get_*` / `list_*` / file GET) |
| --- | --- | --- |
| `Authorization: Bearer $PHYSHUB_AGENT_KEY` | required | required |
| `Idempotency-Key` | required. 1–128 chars, `[A-Za-z0-9._-]+` | not required |
| `X-Request-Id` | optional | optional |

Mutating: create/update draft, raw asset, suggestions, quality-check, question sets, export.

Same key + same body replays the stored response. Same key + different body → `409` `Idempotency-Key reused with a different request body`. In-flight key → `409` `Idempotency-Key in progress`. Missing → `400` `Idempotency-Key is required`. Illegal charset/length → `400` `Invalid Idempotency-Key`.

## Catalog

| Tool | Method / path | Scope | Idempotency |
| --- | --- | --- | --- |
| `search_questions` | `POST /api/agent/search-questions` | `questions:search` | no |
| `get_question` | `GET /api/agent/questions/:id` | `questions:read` | no |
| `list_knowledge_points` | `GET /api/agent/knowledge-points` | `questions:read` | no |
| `list_tags` | `GET /api/agent/tags` | `questions:read` | no |
| `create_raw_asset` | `POST /api/agent/raw-assets` | `drafts:create` | yes (multipart) |
| `get_raw_asset_file` | `GET /api/agent/raw-assets/:id/file` | see tool | no |
| `create_question_draft` | `POST /api/agent/question-drafts` | `drafts:create` | yes |
| `update_question_draft` | `PATCH /api/agent/question-drafts/:id` | `drafts:update` | yes |
| `get_question_draft` | `GET /api/agent/question-drafts/:id` | `drafts:read` | no |
| `submit_suggestions` | `POST /api/agent/suggestions` | `suggestions:create` | yes |
| `check_question_quality` | `POST /api/agent/quality-check` | `quality:check` | yes |
| `create_question_set` | `POST /api/agent/question-sets` | `question_sets:create` | yes |
| `export_question_set` | `POST /api/agent/question-sets/:id/export` | `exports:create` | yes |

No agent publish / delete / promote / accept-suggestion route.

Human-route refusals (not agent tools): `POST /api/questions` → `403` `Agent cannot publish questions`. Other human APIs → `403` `Agent key not accepted on human routes`.

---

### `search_questions`

`POST /api/agent/search-questions`  
Scope: `questions:search`  
Headers: `Authorization`

Body: `{ "query": string, "constraints"?: { status?, limit?, grade?, chapter?, knowledge_points?, difficulty?, usage?, has_image? } }`.

Omitted or empty `constraints.status` → `["REVIEWED"]`.

200:

```json
{
  "understanding": { "rawQuery": "…", "terms": [], "limit": 10 },
  "results": [
    {
      "id": "<cuid>",
      "question_id": "<publicId>",
      "score": 1,
      "reason": "…",
      "reasons": [],
      "stemMd": "…",
      "status": "REVIEWED",
      "type": "SINGLE_CHOICE"
    }
  ]
}
```

`results[].id` is the get-question id. Results have no `answerJson`.

| HTTP | `error` |
| --- | --- |
| 400 | `Search query is required` |
| 400 | `Request body must be an object` |
| 400 | `Malformed JSON request body` |
| 400 | `Search constraints must be an object` |
| 400 | `limit must be a number` / `status contains an invalid value` / field-type strings (`grade must be a string`, …) |
| 500 | `Unable to search questions` |

### `get_question`

`GET /api/agent/questions/:id`  
Scope: `questions:read`  
Headers: `Authorization`  
`:id` = internal `Question.id` (search `results[].id`), not `publicId`.

200: `{ "question": <repository DTO including answerJson> }`.

| HTTP | `error` |
| --- | --- |
| 404 | `Question not found` |
| 500 | `Failed to load question` |

### `list_knowledge_points`

`GET /api/agent/knowledge-points`  
Scope: `questions:read`  
Headers: `Authorization`

200: `{ "knowledgePoints": [{ "id", "name", "slug", "parentId", "sortOrder" }] }`.

| HTTP | `error` |
| --- | --- |
| 500 | `Failed to load knowledge points` |

### `list_tags`

`GET /api/agent/tags`  
Scope: `questions:read`  
Headers: `Authorization`

200: `{ "tags": [{ "id", "name", "slug", "group" }] }`.

| HTTP | `error` |
| --- | --- |
| 500 | `Failed to load tags` |

### `create_raw_asset`

`POST /api/agent/raw-assets`  
Scope: `drafts:create`  
Headers: `Authorization`, `Idempotency-Key`  
`Content-Type: multipart/form-data`. Exactly one of `file` or `text`.

Allowed MIME: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/markdown`, `text/x-markdown`, `text/plain`. Caps: IMAGE 10 MiB, PDF 20 MiB, markdown/text file 1 MiB, `text` field 100_000 chars. Empty `file.type` is rejected.

201:

```json
{
  "request_id": "…",
  "rawAsset": {
    "id": "…",
    "kind": "IMAGE",
    "status": "UPLOADED",
    "originalName": "vt.png",
    "mimeType": "image/png",
    "storageKey": "raw/…-vt.png"
  }
}
```

Does not parse. Does not create a draft.

| HTTP | `error` |
| --- | --- |
| 400 | `Unsupported media type` / `File too large` / `Text too large` / `Provide a non-empty file or text field` |
| 500 | `Unable to create raw asset` |

### `get_raw_asset_file`

`GET /api/agent/raw-assets/:id/file`  
Headers: `Authorization`  
Scope, first match: Question linkage + `questions:read`; else draft linkage + `drafts:read`; else unlinked + `drafts:create`. Else `404` (no existence leak). Pasted-text assets have no file bytes → `404`.

200: file bytes, `Content-Type` = stored mime.

| HTTP | `error` |
| --- | --- |
| 404 | `Raw asset not found` |

Markdown in stems uses `/api/raw-assets/<id>/file`, not this agent path.

### `create_question_draft`

`POST /api/agent/question-drafts`  
Scope: `drafts:create`  
Headers: `Authorization`, `Idempotency-Key`  
`Content-Type: application/json`

Body fields optional (incomplete OK). Default `status`: `DRAFT`. Field schema: [question-contract.md](question-contract.md). Agent body `status` is not used on create.

201: `{ "request_id", "draft": { id, status, type, stemMd, optionsJson, answerJson, solutionMd, difficulty, knowledgePointIds, tagIds, sourceRawAssetId, createdAt, updatedAt, promotedAt } }`.

| HTTP | `error` |
| --- | --- |
| 400 | `Malformed JSON request body` |
| 400 | `Invalid draft status` |
| 400 | zod field messages (joined by `; `) |
| 422 | `Knowledge point not found` / `Tag not found` / `Raw asset not found` |
| 500 | `Unable to save draft` |

### `update_question_draft`

`PATCH /api/agent/question-drafts/:id`  
Scope: `drafts:update`  
Headers: `Authorization`, `Idempotency-Key`

Partial update. Agent `status` may be `"NEEDS_REVIEW"` only (and only from `DRAFT`). Same-status repeat → 200 no-op.

200: `{ "request_id", "draft": { …same draft object as create } }`.

| HTTP | `error` |
| --- | --- |
| 400 | `Invalid draft status` |
| 400 | `Malformed JSON request body` / zod field messages |
| 404 | `Draft not found` |
| 409 | `Draft is not updatable` |
| 422 | `Knowledge point not found` / `Tag not found` / `Raw asset not found` |
| 500 | `Unable to save draft` |

### `get_question_draft`

`GET /api/agent/question-drafts/:id`  
Scope: `drafts:read`  
Headers: `Authorization`

200: `{ "draft": { …create fields, aiOutput, sourceRawAsset, suggestions, agentRuns } }`.

| HTTP | `error` |
| --- | --- |
| 404 | `Draft not found` |
| 500 | `Failed to load question draft` |

### `submit_suggestions`

`POST /api/agent/suggestions`  
Scope: `suggestions:create`  
Headers: `Authorization`, `Idempotency-Key`

Exactly one of `draftId` or `questionId` (`null` / omitted / `""` = absent). `kind`: `"metadata"`. Each `knowledge_points[]` entry needs `id` from `list_knowledge_points`. `tag_ids` from `list_tags`. Created `status` is `pending_review`.

```json
{
  "draftId": "…",
  "kind": "metadata",
  "confidence": 0.86,
  "payload": {
    "knowledge_points": [
      { "id": "<kp id>", "value": "v-t 图像面积表示位移", "confidence": 0.86, "reason": "…" }
    ],
    "difficulty": { "value": 2, "confidence": 0.72, "reason": "…" },
    "tag_ids": ["<tag id>"],
    "risks": []
  }
}
```

201: `{ "request_id", "suggestion": { id, status, kind, payload, draftId, questionId, … } }` with `status: "pending_review"`.

| HTTP | `error` |
| --- | --- |
| 400 | `Provide exactly one of draftId or questionId` |
| 400 | `Malformed JSON request body` |
| 409 | `Draft is not updatable` |
| 422 | `Draft not found` / `Question not found` / `Knowledge point not found` / `Tag not found` / `Suggestion payload missing knowledge point id` |

Agent `PATCH /api/suggestions/:id` is a human route → `403` `Agent key not accepted on human routes`.

### `check_question_quality`

`POST /api/agent/quality-check`  
Scope: `quality:check`  
Headers: `Authorization`, `Idempotency-Key`

Exactly one of `draftId` or `question` (`null` / omitted / `""` = absent). Does not write `Question` or patch the draft. Writes `AgentRun`.

200: `{ "request_id", "publishable": boolean, "errors": string[] }`. `errors` are [validatePublishableQuestion](question-contract.md) Chinese strings. `publishable: true` iff `errors` is empty.

| HTTP | `error` |
| --- | --- |
| 400 | `Provide exactly one of draftId or question` |
| 400 | `question must be an object` |
| 400 | `Request body must be an object` |
| 400 | `Malformed JSON request body` |
| 422 | `Draft not found` |
| 500 | `Unable to check question quality` |

### `create_question_set`

`POST /api/agent/question-sets`  
Scope: `question_sets:create`  
Headers: `Authorization`, `Idempotency-Key`

Body: `{ "title": string, "questionIds": [Question.id, …] }`. Official question ids only (search `results[].id`), not draft ids, not `publicId`.

201: `{ "request_id", "questionSet": { "id", "title", "items": [{ "questionId", "sortOrder" }] } }`.

| HTTP | `error` |
| --- | --- |
| 400 | `title is required` |
| 400 | `questionIds must be a non-empty array` |
| 400 | `questionIds must be unique` |
| 400 | `Malformed JSON request body` |
| 422 | `Question not found` |
| 500 | `Unable to create question set` |

### `export_question_set`

`POST /api/agent/question-sets/:id/export`  
Scope: `exports:create`  
Headers: `Authorization`, `Idempotency-Key`

Body optional: `{ "format"?: "markdown" | "latex", "teacher"?: boolean }`. Default `format`: `markdown`. Default `teacher`: `true` (answers + solutions in `content`).

200: `{ "request_id", "exportJob": { "id", "status", "format", "questionSetId", "outputKey" }, "content": "…" }`. `exportJob.status` is `SUCCEEDED`.

| HTTP | `error` |
| --- | --- |
| 400 | `Request body must be an object` |
| 400 | `format must be markdown or latex` |
| 400 | `Malformed JSON request body` |
| 404 | `Question set not found` |
| 500 | `Unable to export question set` |
