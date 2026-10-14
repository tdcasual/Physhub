# Independent Codex audit of R9

| Field | Value |
| --- | --- |
| Auditor | Codex CLI |
| Date | 2026-10-14 (Asia/Shanghai) |
| HEAD | `3f2e1a9f7c6a12d99d4fb63880a66ec5056af817` |
| Plan path | `docs/plans/2026-10-13-complete-fix-plan.md` |
| Plan revision | R9, independently verified from the current plan |

Verdict: pass

## Executive summary

R9 supplies a sufficient implementation contract for every scoring dimension to reach 9+ against harness-first v1. No major plan defect remains. This is a prospective plan verdict, not a score for current HEAD or certification that the changes have shipped.

Both R8 findings are explicitly closed. Official persistence sends full option rows and refuses incomplete options/answers instead of filtering them; failure retains the overlay and prevents publication. Draft persistence uses distinct tolerant option and answer schemas, explicitly sends cleared answers and nullable difficulty, preserves them through omission handling and repository writes, and retains strict promotion validation. Decision 14 extends the display-only filter rule to persistence generally. These conclusions follow from current R9 text and independently inspected code, not earlier verdicts, Grok scores or chat claims.

Other slices provide concrete queue, upload, search, authorization, attribution, recovery, UI, accessibility, documentation and verification contracts. The in-repo CI workflow and documented single-instance deployment suffice within the stated boundary. No LLM/MCP/Redis/NextAuth addition, origin CI execution or popstate interception is required.

Only this report was changed. The plan and report were already untracked at audit start. No application code was implemented.

## Dimension-by-dimension sufficiency for 9+

These are judgments about faithful implementation and required verification, not numerical scores for current HEAD.

| Dimension | Sufficiency | Basis for 9+ |
| --- | --- | --- |
| Product completeness vs harness-first v1 | Sufficient | Status-complete pageable queue, working upload, exact image/residual search and faithful draft/official persistence complete the identified teacher paths. |
| Teacher closed loop | Sufficient | Complete snapshots, explicit clearing, persist-before-publish/promote, confirmations, dirty-link guard and overlay recovery close loss/staleness paths. |
| Agent/harness path & AI boundary | Sufficient | Creator attribution reaches both agent creation/promotion routes; dev fallback is explicit; REVIEWED-only insertion and human publication rejection remain. |
| Auth / session / secrets | Sufficient | Workbench checks cover human mutations, VIEWER denial is tested, existing scrypt/hashed sessions/wrapped keys remain, and lastUsedAt is throttled. |
| Domain correctness | Sufficient | Status-before-pagination, exact persisted image predicate, residual text, bounded official listing, filtered taxonomy references and tolerant-draft/strict-official validation are concrete. |
| Tests | Sufficient | Shipped-entry-point tests cover overflow, image write-to-search reachability, explicit-null/empty persistence, failed promotion/publication and unmount recovery; check and build must pass. |
| Docs vs code | Sufficient | Slice 7 updates behavior, migration/setup, correct bootstrap variables and local E2E versus CI boundaries. |
| Teacher UI usefulness | Sufficient | Chinese paper styling, shared buttons, pagination, one reject action, confirmations and reliable save behavior address listed gaps. |
| Accessibility / touch / i18n | Sufficient | Single home h1, visible labels, skip targets, key-region semantics, contrast and 44px primary actions have specific checks. |
| Production / ops readiness | Sufficient within v1 | In-repo check workflow, headers, file nosniff/disposition, dashboard gate and local build are reviewable artifacts; single-instance rate limiting is documented. |
| Code quality / maintainability | Sufficient | Shared listing/image/overlay helpers, snapshot builders, explicit schema boundaries, bounded queries and UI tokens address identified defects. |
| Overall | Sufficient | Every dimension has a concrete path to 9+, with zero major plan issues. Implementation evidence remains mandatory. |

## Fact-check against current HEAD

| Plan claim | Independent finding |
| --- | --- |
| Queue take-50-then-filter | **Verified.** `app/(dashboard)/drafts/page.tsx:53` queries all three statuses with take 50; lines 83–89 filter/count that truncated result. Slice 1 specifies status filtering first, stable order, global counts and page 2. |
| Raw-asset POST 500 | **Verified mechanism.** Human POST calls formData at `app/api/raw-assets/route.ts:21`, mapping unknown throws to 500 at lines 30–32. Agent POST does likewise at `app/api/agent/raw-assets/route.ts:38` and lines 98–100. The helper already rejects unsupported MIME and oversized bytes at `lib/domain/raw-asset-upload.ts:149,157`. Production Node multipart is not established as broken. |
| jsdom formData diagnosis | **Independently reproduced.** `vitest.config.ts:13` selects jsdom; neither upload test overrides it. A Node probe using installed jsdom FormData/File with native Request threw `TypeError: Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".` Native Node FormData/File with the same SVG parsed successfully. Node POST tests and malformed-body 400 are justified. |
| Six failing upload tests | **Not independently counted.** No Vitest suite was run. The probe verifies the mechanism, not the numerical baseline. |
| Agent actor owner fallback | **Verified.** `lib/auth/agent-auth.ts:18,94` omits creator identity although `prisma/schema.prisma:379` defines it. Agent promote at `app/api/agent/question-drafts/[id]/promote/route.ts:63` and create at `app/api/agent/questions/route.ts:40` omit actorId. `lib/domain/promote-draft.ts:468,505–511` resolves owner when absent; line 396 persists that actor. R9 forwards creator identity on both routes. |
| has_image uses QuestionAsset | **Verified.** `lib/search/question-search.ts:131,486–487` selects assets and filters some/none; `prisma/schema.prisma:233` defines QuestionAsset. Promotion instead writes sourceRawAssetId at `lib/domain/promote-draft.ts:395`. Actual database relation emptiness was not inspected. The structural mismatch is verified. |
| Intent-only search requires raw literals | **Verified.** `lib/search/question-search.ts:477` adds rawQuery text matching when no KP/grade/chapter/usage clause exists; image/difficulty constraints follow afterward. R9 specifies residual-text matching instead. |
| No CI | **Verified.** `git ls-tree -r --name-only HEAD .github` returned no files; the workspace has no .github directory. package.json check runs lint, typecheck and tests. The workflow is required future work. |
| AST image behavior | **Independently reproduced.** Installed unified/remark-parse/remark-math decoded `/api/raw&#45;assets/` and whitespace destinations into local image URLs, produced definition/imageReference nodes for references, and distinguished a remote image from a local ordinary link. Renderer policy at `lib/renderer/render-markdown.tsx:6` permits the raw-asset prefix. R9 requires direct dependencies and write-to-search tests. |
| Current draft empty-answer/null barriers | **Verified.** `lib/domain/draft-schema.ts:12–15` reuses strict official schemas; omission handling strips null. Shipped-parser probes rejected empty text/single answers and multiple `[]`, and parsed `{difficulty:null}` as empty data. These HEAD barriers are explicitly changed by R9, not evidence against it. |
| Repository/reload support empty values | **Verified.** `lib/domain/question-service.ts:65,72` maps every option and normalizes supplied answers without omitting them. Probes preserved empty text/single values and multiple `[]` through normalization and parseEditableAnswer. `lib/domain/draft-repository.ts:422–435` writes supplied options/answer/difficulty; DTO lines 218–219 returns JSON unchanged. Workspace parseOptions at line 90 accepts empty strings. |
| Official filtering bypasses strict schema | **Independently reproduced at HEAD.** `components/question/official-question-editor.tsx:35` filters incomplete rows. Shipped questionInputSchema rejected full A-complete/B-empty rows but accepted filtered A-only rows. R9 lines 126,142,446–455 explicitly prohibit this persistence behavior. |
| Official/promote remain strict | **Verified prerequisite.** Official parsing uses questionInputSchema (`lib/domain/question-repository.ts:155`); promotion uses strict option/answer schemas (`lib/domain/promote-draft.ts:94–103`) and final publishable/schema validation at lines 143–152. R9 keeps strict gates and forbids filtering incomplete rows to pass. |
| Difficulty and version prerequisites | **Verified.** Official domain clears provided-null at `lib/domain/official-question.ts:150–152`; draft repository writes defined null, but current draft schema/editor omit it. Question has versions, not a scalar version (`prisma/schema.prisma:206`); current official page omits versions. R9 specifies nullable schemas, null-inclusive snapshots, latest QuestionVersion-derived baselines and response-based advancement. |
| Playwright docs env mismatch | **Verified.** `docs/development.md:77` claims EDITOR_SESSION_SECRET; playwright.config.ts injects TEACHER_BOOTSTRAP_USERNAME/PASSWORD. Slice 7 corrects it. |

No full suite, build, browser or database run is claimed. Cheap probes used installed multipart/parser packages and shipped schema/normalization/editor-answer modules. The tsx CLI initially hit sandbox IPC EPERM; the module probe succeeded through Node with the tsx import hook. This tool limitation is not a product defect.

## Explicit closure checks

“Closed” means closed in the R9 implementation contract, not fixed at current HEAD.

| IDs | R9 assessment |
| --- | --- |
| M1 | **Closed.** Lines 148–173 require status filtering before take, stable ordering, global counts, navigation and the 51 same-status/page-2 proof. |
| M2 / A1 / F2 / F3 | **Closed.** Lines 224–289 require parsed local image/reference nodes or IMAGE source, indexed hasRenderedImage, write-path maintenance, migration/backfill, exact true/false column filtering and entity-decoded write-to-search coverage. No scan cap or literal prefilter. |
| M3 | **Closed.** Lines 291–318 require residual text, alias/control consumption, no raw-literal matching for intent-only queries and meaningful leftover terms. |
| M4 / R5-N1 | **Closed through recovery.** Decision 12 requires synchronous change writes or unmount cleanup flushing, pagehide/hidden flushing, version-compatible hydration, dirty-link confirmation and beforeunload. Slice 6 tests unmount/remount recovery. SPA recovery does not depend on pagehide alone; no history interception/trapping is specified. |
| M5 / A3 / R6-N1 | **Closed.** Decision 13 and lines 438–484 require complete snapshots, nullable difficulty, explicit-null preservation, persist-before-status/promote, failure retention and save/reload/promote tests. Combined PATCH is acceptable only with transactional content-before-status behavior; current HEAD's status-first handler is not claimed to satisfy that alternative. |
| R7-N1 | **Closed.** Lines 128–140 define tolerant draftOptionSchema, full-row persistence, omission-preserves semantics and agent parity; line 483 requires unfinished-row save/reload success and strict promotion failure until filled. |
| R8-N1 | **Closed.** Lines 126,142,440–468 replace filtered official payloads with full rows and refusal on incomplete options/answers. Failure retains dirty/overlay state and prevents publication. Line 474 requires the precise B-cleared/A-answer regression and successful recovery after filling B. |
| R8-N2 | **Closed.** Lines 128–140 define tolerant text/single/multiple draft answers, explicit empty payloads and preservation through omission handling/repository writes; official/promote remain strict. Line 484 requires existing answer → empty save/reload and failed promotion. Downstream normalization/reload compatibility was independently checked. |

## Issues

### Major

None. No identified remaining defect forces a dimension to stay at 8 after faithful implementation and required verification.

### Minor

None recorded.

### Nit R9-n1 — Direct creation-path coverage for the class rule

Decision 14 already makes previewOptions/validOptions display-only across persistence, so faithful implementation must also change `components/question/question-editor.tsx:104`, which currently sends filtered options when creating a draft. Detailed regressions concentrate on official editing and draft review. Add a new-question save test with an unfinished option and empty answer, asserting POST sends full rows and successful draft reload retains them. This strengthens verification of the existing class requirement; it does not require another product decision or block the verdict.

**Totals: 0 major, 0 minor, 1 nit.**
