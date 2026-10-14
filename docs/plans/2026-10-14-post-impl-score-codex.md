# Independent audit of the implemented Physhub tree

| Metadata | Verified value / evidence |
| --- | --- |
| Auditor | Codex CLI; independent source inspection and fresh `npm run check` / `npm run build`. |
| Date | 2026-10-14, Asia/Shanghai; `date -Iseconds` returned `2026-10-14T02:57:22+08:00`. |
| HEAD + dirty note | `3f2e1a9f7c6a12d99d4fb63880a66ec5056af817` (`git rev-parse HEAD`). `git status --short` confirms many modified and untracked implementation files; this audit scores the current working tree, not HEAD. |
| Plan | Verified R9: `docs/plans/2026-10-13-complete-fix-plan.md:7`; stated harness-first boundary: `docs/plans/2026-10-13-complete-fix-plan.md:8`. |

Verdict: pass

## Executive summary

**Overall: 9/10 against harness-first v1. Every dimension reaches 9.** Independently executed `npm run check` passed lint, TypeScript and **472 tests in 61 files**; `npm run build` exited 0. The two previously blocking metadata-accept defects are fixed in this working tree. The server returns authoritative metadata and updatedAt; the client replaces metadata and advances the overlay base. Regression tests verify subsequent save and recovery of an unsaved stem after remount.

This assessment uses code and freshly executed checks, not prior scores or chat claims. No application code was edited. Browser E2E, a live PostgreSQL migration/backfill, deployment and origin CI were not executed in this audit. These are verification limits, not claimed successes. Missing Redis, Playwright browsers, E2E in CI and origin push incur no deduction against this v1. Single-instance rate limiting and local-only E2E are documented (`README.md:62`, `README.md:95`).

## Scores

| Dimension | Score 0-10 | Evidence (file:line or command) |
| --- | --- | --- |
| Product completeness vs harness-first v1 | 9 | Status-filtered pageable queue: `lib/domain/draft-listing.ts:55`, `app/(dashboard)/drafts/page.tsx:71`; edit/review/promote: `components/draft/draft-review-workspace.tsx:275`; search/export: `lib/search/question-search.ts:521`, `components/search/question-set-basket.tsx:68`. `npm run check` passed. |
| Teacher closed loop | 9 | Full save/persist-before-promote: `components/draft/draft-review-workspace.tsx:271`, `:329`; persist-before-publish and confirmed deprecation: `components/question/official-question-editor.tsx:217`, `:232`; accept/save and remount regressions: `tests/unit/draft-review-workspace.test.tsx:532`, `:567`. |
| Agent/harness path & AI boundary | 9 | Agent create uses promote/key creator: `app/api/agent/questions/route.ts:40`; draft promote actor: `app/api/agent/question-drafts/[id]/promote/route.ts:65`; fixed REVIEWED insertion: `lib/domain/question-repository.ts:88`; agents rejected on human routes: `lib/auth/human-auth.ts:285`; boundary tests: `tests/unit/agent-promote-routes.test.ts:212`, `:405`. Runtime search `rg -n 'openai|anthropic|redis|bullmq|meilisearch|next-auth|fetch\(' lib app/api -g '*.ts'` found no matches; dependencies inspected in `package.json:24`. |
| Auth / session / secrets | 9 | Scrypt: `lib/auth/password.ts:35`; random tokens, SHA-256 session lookup, expiry/disabled-user checks, secure HttpOnly cookie: `lib/auth/human-auth.ts:36`, `:128`, `:188`; OWNER/EDITOR write gate: `lib/auth/human-auth.ts:310`; key hash/revocation/touch throttle: `lib/auth/agent-auth.ts:71`; AES-GCM: `lib/auth/api-key-wrap.ts:36`; VIEWER regression: `tests/unit/human-auth.test.ts:551`. |
| Domain correctness | 9 | Filter before pagination: `lib/domain/draft-listing.ts:68`; AST figures: `lib/search/question-image.ts:26`; maintained image column: `lib/domain/promote-draft.ts:392`, `lib/domain/official-question.ts:177`; residual text/exact image WHERE: `lib/search/question-search.ts:521`; bounded list: `lib/domain/question-repository.ts:183`; JSON containment count: `lib/domain/taxonomy-write.ts:40`; unfinished/null draft fields retained: `lib/domain/draft-schema.ts:5`, `:99`; strict promotion input: `lib/domain/promote-draft.ts:383`. |
| Tests | 9 | Fresh `npm run check` exited 0: lint + tsc + Vitest, 61 files / 472 tests passed. Acceptance response: `tests/unit/suggestion-review-route.test.ts:626`; acceptance remount/save: `tests/unit/draft-review-workspace.test.tsx:532`, `:567`; overflow: `tests/unit/draft-listing.test.ts:50`; entity image: `tests/unit/question-image.test.ts:47`; publish persistence: `tests/unit/official-question-editor.test.tsx:60`. |
| Docs vs code | 9 | Queue, actor, snapshots, overlay/image search: `README.md:51`, `:74`; migration/backfill: `docs/development.md:31`; actual Playwright variables: `playwright.config.ts:18`, documented at `docs/development.md:86`; CI claim matches `README.md:95` and `.github/workflows/check.yml:16`. Two documentation nits below. |
| Teacher UI usefulness | 9 | Chinese tabs/counts/preview/pagination: `app/(dashboard)/drafts/page.tsx:78`, `:165`; labelled review workspace: `components/draft/draft-review-workspace.tsx:521`; Chinese save/publish feedback: `components/question/official-question-editor.tsx:163`; taxonomy and key management: `components/taxonomy/taxonomy-admin.tsx:141`, `components/agent-keys/agent-key-manager.tsx:201`; Chinese component assertions passed in `npm run check`. |
| Accessibility / touch / i18n | 9 | zh-CN/skip link: `app/layout.tsx:21`; draft main target: `components/draft/draft-review-workspace.tsx:521`; one home h1: `app/page.tsx:19`; shared 44px buttons: `components/ui/button.tsx:24`; taxonomy labels: `components/taxonomy/taxonomy-admin.tsx:141`; issued-key section: `components/agent-keys/agent-key-manager.tsx:220`; darker ink/focus/reduced motion: `app/globals.css:10`, `:65`. Browser layout/assistive-technology behavior was not measured. |
| Production / ops readiness | 9 | Fresh `npm run build` exited 0; CI installation/generation/check: `.github/workflows/check.yml:14`; security headers: `next.config.ts:3`; dashboard gate: `app/(dashboard)/layout.tsx:9`; authenticated nosniff/encoded file response: `app/api/raw-assets/[id]/file/route.ts:48`; single-instance invariant: `README.md:62`; image migration/backfill: `prisma/migrations/20261014090000_has_rendered_image/migration.sql:2`, `docs/development.md:38`. Nonfatal build warning below. |
| Code quality / maintainability | 9 | Shared listing: `lib/domain/draft-listing.ts:55`; shared snapshot builders: `lib/ui/editor-patches.ts:54`, `:70`; shared overlay/acknowledgement: `lib/ui/editor-overlay.ts:85`, `:183`; transactional conditional promotion claim: `lib/domain/promote-draft.ts:361`; lint/typecheck in `npm run check` passed. `git diff --check` found one blank-line nit. |
| Overall | 9 | All dimensions satisfy the verified v1 bar; `npm run check` and `npm run build` exited 0; former blockers have passing regressions at `tests/unit/suggestion-review-route.test.ts:626`, `tests/unit/draft-review-workspace.test.tsx:532`, `:567`. |

## Fact checks

True/false describes the current tree. Earlier defect claims can be false while their corresponding fix claims are true.

| Claim | Current finding | Evidence |
| --- | --- | --- |
| Accept changes draft.updatedAt without advancing overlay base. | **False** on the successful draft metadata path. | Draft update: `lib/domain/suggestion-policy.ts:278`; returned timestamp: `app/api/suggestions/[id]/route.ts:153`; client advances: `components/draft/draft-review-workspace.tsx:477`; hook ref/storage update: `lib/ui/editor-overlay.ts:213`. |
| Client merges only KPs, then save/promote rolls back accepted difficulty/tags. | **False** for the shipped response contract. | Replacement setters: `components/draft/draft-review-workspace.tsx:455`; save/promotion share full snapshot: `:271`, `:340`; save regression: `tests/unit/draft-review-workspace.test.tsx:567`. The legacy merge-only fallback remains for responses without draft, but the current successful draft metadata route supplies draft (`app/api/suggestions/[id]/route.ts:137`). |
| Successful metadata accept returns draft updatedAt/knowledgePointIds/difficulty/tagIds. | **True** for an existing draft target; official-only accepts do not return draft. | Select/response: `app/api/suggestions/[id]/route.ts:137`, `:148`; exact response and ISO serialization assertion: `tests/unit/suggestion-review-route.test.ts:655`. |
| Client replaces metadata and calls overlay.advanceBase(updatedAt). | **True**. | Array replacement and nullable difficulty: `components/draft/draft-review-workspace.tsx:457`, `:465`, `:469`; advanceBase: `:478`. |
| Save after accept sends accepted metadata. | **True**, directly tested. Promotion's preliminary save uses the same snapshot. | Request assertion: `tests/unit/draft-review-workspace.test.tsx:600`; builder: `lib/ui/editor-patches.ts:70`; promotion persistence: `components/draft/draft-review-workspace.tsx:340`. No separate accept-then-promote browser execution is claimed. |
| Unsaved stem survives remount after metadata accept. | **True**, remounting with the refreshed server updatedAt. | Edit/accept/unmount/remount with new timestamp/metadata and stem/banner assertions: `tests/unit/draft-review-workspace.test.tsx:532`; version match and unmount flush: `lib/ui/editor-overlay.ts:139`, `:176`. |
| Same-status overflow and buried NEEDS_REVIEW drafts are reachable. | **True**. | Status/skip query: `lib/domain/draft-listing.ts:68`; page controls: `app/(dashboard)/drafts/page.tsx:165`; regressions: `tests/unit/draft-listing.test.ts:30`, `:50`. |
| Image search uses IMAGE sources/rendered local figures; intent-only search avoids literal intent text. | **True**. | AST helper: `lib/search/question-image.ts:26`, `:84`; residual/column WHERE: `lib/search/question-search.ts:521`; entity and intent regressions: `tests/unit/question-image.test.ts:47`, `tests/unit/question-search.test.ts:415`. |
| Upload failures map to 400 and file delivery has safe headers. | **True** for tested malformed, unsupported and oversized inputs. | Body/error mapping: `app/api/raw-assets/route.ts:23`, `:37`; sniff/limits: `lib/domain/raw-asset-upload.ts:56`, `:233`; regressions: `tests/unit/raw-assets-route.test.ts:177`, `:232`, `:292`. |
| Difficulty clears; incomplete drafts save while official save/promote stay strict. | **True**. | Draft null preservation: `lib/domain/draft-schema.ts:31`, `:99`; full patch: `lib/ui/editor-patches.ts:82`; official guard/domain null: `components/question/official-question-editor.tsx:129`, `lib/domain/official-question.ts:154`; strict promotion: `lib/domain/promote-draft.ts:383`. |
| Agents can publish official questions. | **False**, as required by v1. | Fixed REVIEWED insertion: `lib/domain/question-repository.ts:88`; human-route agent rejection: `lib/auth/human-auth.ts:285`; 403 regressions: `tests/unit/agent-promote-routes.test.ts:405`, `:424`. |

## Issues

**Major:** None found within the stated v1. The two former blocking acceptance defects are closed by the cited source paths and passing regression tests (`tests/unit/suggestion-review-route.test.ts:626`, `tests/unit/draft-review-workspace.test.tsx:532`, `:567`).

**Minor:** None identified that prevents a dimension reaching 9. Live database migration/backfill and browser E2E were not exercised; this report makes no deployment or visual-accessibility certification claim (`npm run check`, `npm run build`, `docs/development.md:88`).

**Nits:**

- README setup mentions seed before database/dependency setup and still names only the initial migration. The development guide correctly specifies all migrations and image backfill. Align the primary setup sequence (`README.md:24`, `README.md:38`, `docs/development.md:31`).
- Development docs call the session token “HMAC hex”; it is a random token looked up using SHA-256 (`docs/development.md:62`, `lib/auth/human-auth.ts:36`, `:40`).
- Successful production build emitted a Turbopack NFT warning about broad project tracing through storage-service. Review packaging scope before a future deployment; this warning alone does not establish functional failure (`npm run build`, `lib/storage/storage-service.ts:71`).
- Extra blank line at EOF: `git diff --check` exited 2 and identified `tests/unit/question-search.test.ts:443`.
