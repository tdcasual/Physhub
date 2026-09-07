---
name: physhub
description: Ingest existing high-school physics questions (image, PDF, markdown, or pasted text) into Physhub drafts via /api/agent. Do not use to invent new questions.
---

# Physhub

Endpoints, scopes, headers, shapes, and error strings: [references/api.md](references/api.md).
Option/answer JSON and `answer.value`: [references/question-contract.md](references/question-contract.md).

## When to use

Structure **existing** physics questions from material the user already has (image, PDF, markdown, pasted text). Do not generate new stems. If there is no source, stop and ask.

## Auth

`Authorization: Bearer $PHYSHUB_AGENT_KEY`. Call only `/api/agent/*`.

Add `Idempotency-Key` (1–128 chars, `[A-Za-z0-9._-]+`) on mutating tools: create/update draft, raw asset, suggestions, quality-check, question sets, export. `search_questions` / `get_*` / `list_*` do not require it and do not fail without it.

This key on `POST /api/questions` → `403` `Agent cannot publish questions`. Other human routes → `403` `Agent key not accepted on human routes`.

## Legal write path

Allowed writes: raw asset, draft, suggestion, question set, export, quality-check.

There is no agent publish, delete, or promote tool, and no agent accept-suggestion tool. Agent PATCH may set draft `status` to `NEEDS_REVIEW` only. `PROMOTED` / `REJECTED` drafts → `409` `Draft is not updatable`.

When `POST /api/agent/suggestions` is available, that is the suggestion write (contract in [api.md](references/api.md)). If it 404s, this checkout does not have the route yet; skip submit and keep `draft.id`. Do not invent another path.

## Required prelude

Before sending `knowledgePointIds` or `tagIds`, `GET /api/agent/knowledge-points` and `GET /api/agent/tags`. Use returned `id` values. Names and slugs are not ids.

## Answer contract

For choice questions, `answer.value` is the option **label** (`A` / `B`), not the option text. Details in [question-contract.md](references/question-contract.md).

## Upload then hang source

If there is a file or pasted source, `POST /api/agent/raw-assets` first and keep `rawAsset.id`. Unlinked files are readable immediately via `GET /api/agent/raw-assets/:id/file` (`drafts:create`). Then set the draft's `sourceRawAssetId` to that id.

Stem figures: `![](/api/raw-assets/<id>/file)` (allowlist prefix `/api/raw-assets/`). Data URLs and other src values are dropped at render. Do not inline image bytes into `stemMd`.

## Persist `draft.id`

`POST /api/agent/question-drafts` `201` includes `draft.id`. Save it. There is no agent list-drafts. Later `PATCH /api/agent/question-drafts/:id` and `POST /api/agent/quality-check` with `draftId` need it. When `POST /api/agent/suggestions` is available, it needs the same id. Losing it means a human must look it up in the UI.

## 422 recovery

`Knowledge point not found` (or `Tag not found`): list again, substitute a returned `id`, **new** `Idempotency-Key`, retry. Reusing the same key with a different body → `409` `Idempotency-Key reused with a different request body`.

## Search

`POST /api/agent/search-questions` body is natural-language `query` plus optional `constraints`. Not SQL / Prisma `where`.

Official questions are `REVIEWED` or `PUBLISHED`. Omit `constraints.status` (or send `[]`) and the server defaults to `["REVIEWED","PUBLISHED"]`. `DEPRECATED` is excluded unless you pass it explicitly.

`get_question` takes `results[].id` (internal cuid). `results[].question_id` is `publicId` and will 404.

## Quality check

After saving a draft, `POST /api/agent/quality-check` with that `draft.id`. Leave `errors` for the teacher; do not guess knowledge-point ids to clear them.

`publishable: true` means ask a human to promote. It does not insert a `Question` and is not published.
