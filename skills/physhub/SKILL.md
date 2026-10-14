---
name: physhub
description: Ingest existing high-school physics questions (image, PDF, markdown, or pasted text) into Physhub drafts or the official bank via /api/agent. Do not use to invent new questions.
---

# Physhub

Endpoints, scopes, headers, shapes, and error strings: [references/api.md](references/api.md).
Option/answer JSON and `answer.value`: [references/question-contract.md](references/question-contract.md).

## When to use

Structure **existing** physics questions from material the user already has (image, PDF, markdown, pasted text). Do not generate new stems. If there is no source, stop and ask.

## Auth

`Authorization: Bearer $PHYSHUB_AGENT_KEY`. Call only `/api/agent/*`. Teachers issue and copy this key on the 密钥 page (`/agent-keys`); do not invent another secret.

Add `Idempotency-Key` (1–128 chars, `[A-Za-z0-9._-]+`) on mutating tools: create/update draft, create official question, promote draft, raw asset, suggestions, quality-check, question sets, export. `search_questions` / `get_*` / `list_*` do not require it and do not fail without it.

This key on human `POST /api/questions` or `POST /api/drafts/:id/promote` → `403` `Agent cannot publish questions`. Other human routes → `403` `Agent key not accepted on human routes`. Ingest only through `/api/agent`.

## Legal write path

Allowed writes: raw asset, draft, official question (`REVIEWED`), promote draft, suggestion, question set, export, quality-check.

There is no agent delete, accept-suggestion, or `PUBLISHED`/`DEPRECATED` tool. Agent PATCH may set draft `status` to `NEEDS_REVIEW` only. `PROMOTED` / `REJECTED` drafts → `409` `Draft is not updatable`.

To put a complete question in the bank: `POST /api/agent/questions` (create + promote) or `POST /api/agent/question-drafts/:id/promote` after `publishable: true`. Result status is `REVIEWED`, not `PUBLISHED`. The official row’s `createdById` is the API key’s `createdById` when the key has a teacher creator.

Submit suggestions with `POST /api/agent/suggestions` (contract in [api.md](references/api.md)). Do not invent another path.

## Required prelude

Before sending `knowledgePointIds` or `tagIds`, `GET /api/agent/knowledge-points` and `GET /api/agent/tags`. Use returned `id` values. Names and slugs are not ids.

## Answer contract

For choice questions, `answer.value` is the option **label** (`A` / `B`), not the option text. Details in [question-contract.md](references/question-contract.md).

## Upload then hang source

If there is a file or pasted source, `POST /api/agent/raw-assets` first and keep `rawAsset.id`. Unlinked files are readable immediately via `GET /api/agent/raw-assets/:id/file` (`drafts:create`). Then set the draft's `sourceRawAssetId` to that id.

Stem figures: `![](/api/raw-assets/<id>/file)` (allowlist prefix `/api/raw-assets/`). Data URLs and other src values are dropped at render. Do not inline image bytes into `stemMd`.

## Persist `draft.id`

`POST /api/agent/question-drafts` `201` includes `draft.id`. Save it. There is no agent list-drafts. Later `PATCH /api/agent/question-drafts/:id`, `POST /api/agent/quality-check` with `draftId`, `POST /api/agent/suggestions`, and `POST /api/agent/question-drafts/:id/promote` need it. Losing it means a human must look it up in the UI. `POST /api/agent/questions` returns `question.id` (use that with `get_question` / sets).

## 422 recovery

`Knowledge point not found` (or `Tag not found`): list again, substitute a returned `id`, **new** `Idempotency-Key`, retry. Reusing the same key with a different body → `409` `Idempotency-Key reused with a different request body`.

## Search

`POST /api/agent/search-questions` body is natural-language `query` plus optional `constraints`. Not SQL / Prisma `where`. `constraints.has_image` matches an IMAGE-kind source or a **parsed** local markdown image (`/api/raw-assets/…` in the stem AST), via `Question.hasRenderedImage`. PDF/text sources and ordinary links do not count. Intent-only `有图` / `基础题` do not require those words in the stem.

Official questions are `REVIEWED` or `PUBLISHED`. Omit `constraints.status` (or send `[]`) and the server defaults to `["REVIEWED","PUBLISHED"]`. `DEPRECATED` is excluded unless you pass it explicitly.

`get_question` takes `results[].id` (internal cuid). `results[].question_id` is `publicId` and will 404.

## Quality check

After saving a draft, `POST /api/agent/quality-check` with that `draft.id`. Leave `errors` for the teacher; do not guess knowledge-point ids to clear them.

`publishable: true` means the draft can be promoted with `POST /api/agent/question-drafts/:id/promote`. That inserts a `Question` at `REVIEWED`. It is not `PUBLISHED`.
