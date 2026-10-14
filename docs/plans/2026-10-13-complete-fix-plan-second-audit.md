# Independent second audit of R9

| Field | Value |
| --- | --- |
| Auditor | independent subagent |
| Date | 2026-10-14 |
| HEAD | `3f2e1a9` (`3f2e1a9f7c6a12d99d4fb63880a66ec5056af817`, `feat: refresh workbench UI copy, tokens, and skill docs`) |
| Plan path | `docs/plans/2026-10-13-complete-fix-plan.md` |
| Plan revision | R9 — official never filters incomplete options; draft-tolerant answer/options; promote stays strict |

Verdict: pass

## Executive summary

R9 is a complete enough implementation contract that, if followed, every listed scoring dimension can honestly reach 9 or 10 against harness-first v1. This is a plan verdict, not a score of current HEAD and not a claim that the work has shipped.

HEAD still has the holes the plan names: the draft queue takes 50 mixed unpromoted rows and filters in memory; official 「上架」 is a status-only PATCH; both human editors drop `difficulty: null` and persist a filtered `previewOptions` list; draft validation reuses official `optionSchema` / `answerSchema`; `has_image` queries unused `QuestionAsset`; intent-only search still `textContains`s the raw phrase; mutating teacher routes mostly omit `{ workbench: true }`; there is no in-repo CI workflow. R9 specifies concrete replacements, write paths, and tests that import shipped modules. Non-goals (no in-process LLM/MCP/Redis/NextAuth; agents insert `REVIEWED` only; in-repo workflow as the ops 9+ artifact; documented single-instance rate limit; overlay recovery instead of popstate cancellation) match the v1 bar and are not treated as remaining 8-score holes.

No major plan defect remains. Minors below are implementation traps, not missing product contracts.

## Dimension-by-dimension: is planned work sufficient for 9+?

Judgments are about faithful implementation of R9, not current HEAD scores.

### Product completeness vs harness-first v1 — sufficient

**Plan:** Scoring table (product row); Goal items 1–4; Slices 1, 2, 4, 6.

**HEAD evidence:** `app/(dashboard)/drafts/page.tsx` `getUnpromotedDrafts` queries `status in [DRAFT, NEEDS_REVIEW, REJECTED]` with `take: 50`, then the page filters that slice for the tab and derives counts from it. A `NEEDS_REVIEW` row behind 50 newer `DRAFT`s never appears, and the 51st same-status row is unreachable. Upload POST maps unknown throws to 500. Search `has_image` uses `assets: { some/none }`. Teacher chrome is mixed English/stone (`option-editor.tsx` “Remove”, `question-search-panel.tsx` “Add to basket”, `draft-review-workspace.tsx` “Structured draft”).

**Why 9+ after ship:** Slice 1 makes the tab a Prisma `where.status` query plus page/skip (or cursor) and global `groupBy` counts, with an overflow test (51 `NEEDS_REVIEW`, page 2 returns the last). Slice 2 makes POST tests run in node and map `formData()` failure to 400 without claiming production Node multipart is broken. Slice 4 persists `hasRenderedImage` from IMAGE source or parsed local figures and strips control phrases from search text. Slice 6 translates the remaining teacher-visible strings on 工作台/录入/审题/题库/知识点/密钥 and switches those surfaces to paper tokens/`Button`. Agents still cannot `PUBLISHED`. That is a closed teacher loop for v1, not a SaaS marketplace.

### Teacher closed loop — sufficient

**Plan:** Decision 12–14; Slice 1; Slice 6 persist-before-publish and overlay; test matrix rows for overlay, 上架, draft 未设, incomplete options, empty answers.

**HEAD evidence:** Official 「上架」 calls `patch({ status: "PUBLISHED" })` (`components/question/official-question-editor.tsx`). The PATCH handler, when `status` is `PUBLISHED` or `DEPRECATED`, runs `updateOfficialQuestionStatus` and ignores other fields (`app/api/questions/[id]/route.ts`). Save/promote payloads omit `difficulty` unless it is a number and send `previewOptions` (complete rows only). Draft workspace already persist-then-promote, but `buildEditorFields` drops null difficulty, empty answers, and incomplete options. Next.js `Link` in `components/nav.tsx` has no dirty guard. 「停用」 and taxonomy delete have no confirm. Dual 「退回」/「退回草稿」 remain.

**Why 9+ after ship:** Queue completeness unblocks 待审. Overlay recovery plus capture-phase link confirm is the allowed v1 unsaved-work contract (R1: confirm **or** recovery; R5-N1 forbids popstate cancellation). Official 上架 persists `buildOfficialEditorPatch()` (full options, `difficulty: number | null`) before a status-only publish, and failed persist must not publish or clear overlay. Draft snapshots are complete and tolerant; promote stays strict. Destructive actions get `window.confirm`; one 「退回」 remains. Tests named in Slice 6 force the regressions that previously kept this dimension at 8.

### Agent / harness path and AI boundary — sufficient

**Plan:** Key decision 5; Slice 3; non-goals (agents insert `REVIEWED` only).

**HEAD evidence:** `AgentAuth` is `{ apiKeyId, name, scopes }` (`lib/auth/agent-auth.ts`). `lookupApiKey` does not select `ApiKey.createdById` even though the column exists (`prisma/schema.prisma`). Agent promote and agent official create call `promoteDraftToQuestion` / `createQuestionByPromotingDraft` without `actorId`; the domain falls back to the seed owner (`lib/domain/promote-draft.ts`). Human promote already passes `auth.session.userId`. `tests/unit/agent-cannot-publish.test.ts` already asserts 403 on human `POST /api/questions`.

**Why 9+ after ship:** Forward `actorId: agent.createdById ?? undefined`; keep owner fallback only for `createdById: null` (dev-agent); do not invent a User row; do not relax 403 on human publish URLs. That is the remaining 8-score attribution hole. The rest of the harness boundary is already in place.

### Auth / session / secrets — sufficient

**Plan:** Key decision 9; Slice 5.

**HEAD evidence:** `requireHumanApiAuth(..., { workbench: true })` is used on API-key routes only. `PATCH /api/questions/:id`, drafts, taxonomy, raw-assets POST, suggestions, question-sets, and export omit it. Login already rejects `VIEWER` (`app/api/auth/login/route.ts`), so the write hole is latent (planted session / future VIEWER). `lookupApiKey` writes `lastUsedAt` on every successful lookup. Sessions remain hashed cookies; passwords remain scrypt; logout DELETE already exists. Rate limit is an in-process `Map`.

**Why 9+ after ship:** `{ workbench: true }` on every human mutating route, with a VIEWER PATCH 403 test, closes the latent writer. 60s `lastUsedAt` throttle removes write amplification. Scrypt / hashed sessions / wrapped keys stay. Single-instance in-memory rate limit is an explicit non-goal if README keeps the invariant. NextAuth is not required.

### Domain correctness — sufficient

**Plan:** Key decisions 1, 6, 7, 11, 13, 14; Slices 1, 4, 5 (listQuestions + taxonomy JSON); Slice 6 schemas.

**HEAD evidence:** Queue take-then-filter (above). `buildQuestionSearchWhere` uses `assets` some/none and, when no KP/grade/chapter/usage clause exists, `textContains(understanding.rawQuery)` — so `有图` / `基础题` require those literals in stem/solution/KP/tags. `Question.hasRenderedImage` does not exist. `listQuestions` is unbounded `findMany`. Taxonomy delete loads every draft’s JSON arrays in process (`lib/domain/taxonomy-write.ts`). Draft `questionDraftFieldSchema` reuses official `optionSchema` / `answerSchema`; `omitAbsentDraftFields` deletes `difficulty: null` via `isAbsent`. Official save filters incomplete option rows so strict schema can pass.

**Why 9+ after ship:** Status-filtered pagination; persisted AST+IMAGE boolean with no 200-cap and no `stemMd contains "/api/raw-assets/"` prefilter; residual text; `listQuestions` `take: 50`; JSON `array_contains` (or `$queryRaw`) for taxonomy delete; nullable official difficulty; distinct tolerant draft option/answer schemas; official/promote refuse incomplete rows instead of dropping them. Write-path tests (entity-encoded stem found by `有图`; IMAGE/PDF/mixed/code table; draft empty option saves and promote fails) are the 9+ evidence, not helper-only classification.

### Tests — sufficient

**Plan:** Test matrix; Slice 2 node env; Slice 1 overflow; Slice 4a/4b tables; Slice 6 overlay and persist tests; `npm run check` / `npm run build`.

**HEAD evidence:** Vitest default `environment: "jsdom"` (`vitest.config.ts`). Independently run: 6 POST cases fail with 500 vs 400/201 (`raw-assets-route.test.ts` SVG + oversize; `agent-raw-assets.test.ts` create, SVG, oversize, idempotent replay). `drafts-page.test.tsx` still asserts `status: { in: [DRAFT, NEEDS_REVIEW, REJECTED] }` plus `take: 50`. No overflow, residual-search, persist-publish, or overlay tests exist. `package.json` `check` is lint + typecheck + unit tests.

**Why 9+ after ship:** The matrix requires tests to import shipped page/route/editor/search modules, including 51-row overflow, signed fixtures, node POST 400s, column search after entity-encoded write, overlay unmount/remount, official refuse-to-filter, draft empty answer/option, and `npm run check` exit 0. Playwright is evidence, not a CI gate. That is enough verification for 9; axe CI and virtualized lists are non-goals.

### Docs vs code — sufficient

**Plan:** Slice 7.

**HEAD evidence:** README describes drafts/official promote and `npm run check` but not status+page listing, magic sniff, `nosniff` disposition, promote `createdById`, `has_image` as IMAGE-or-parsed-figure, residual intent, overlay recovery, or persist-including-null-difficulty. `docs/development.md` still says Playwright injects `EDITOR_SESSION_SECRET`; `playwright.config.ts` actually injects `TEACHER_BOOTSTRAP_USERNAME` / `TEACHER_BOOTSTRAP_PASSWORD`. Setup text still highlights the init migration only. No CI workflow to document.

**Why 9+ after ship:** Slice 7 requires a sentence per new behavior, the correct Playwright env names, “all committed migrations”, “CI runs `npm run check`; E2E is local”, and a skill/api line on `has_image` / actor. It also forbids claiming origin is synced or that E2E runs in CI. That matches the docs-vs-code 9 bar.

### Teacher UI usefulness — sufficient

**Plan:** Key decision 10; Slice 6 file table.

**HEAD evidence:** Core edit path still English (option/answer editors, draft “Structured draft” / “Editable Parser Output”, search “N results” / “Add to basket”, basket default `"Untitled set"` and “Create and export”, upload “Attached raw asset”, toasts `Unable to update…` / `Saved version`). Dual visual systems (`stone-900` vs `--paper/--seal`). Overflow backlog and stale 上架 as above.

**Why 9+ after ship:** The file table plus “all teacher-visible strings in these files become Chinese” plus `Button`/`min-h-11` plus persist-before-publish plus pagination chrome covers 工作台/录入/审题/题库/知识点/密钥. Existing tests that `getByRole` English names must be updated in the same slice so `npm run check` stays the bar. No new component library.

### Accessibility / touch / i18n — sufficient

**Plan:** Slice 5 skip link + `id="main"`; Slice 6 a11y rows; scoring table a11y row.

**HEAD evidence:** `app/page.tsx` marketing `h1`「题库工作台」 and `UnlockForm` `h1`「登录」 (`tests/unit/home-page.test.tsx` asserts both headings). `html` already `lang="zh-CN"`. No skip link. Taxonomy create fields are placeholder-only (`taxonomy-admin.tsx`). Review actions are `py-2` without `min-h-11`. Issued key block is `role="dialog"` (`agent-key-manager.tsx`) despite being in-page. `--ink-faint` is `oklch(52% 0.015 250)` vs `--ink-soft` `38%`.

**Why 9+ after ship:** One home `h1`; UnlockForm `h2`; visible `label htmlFor`; skip → `#main` including UnlockForm/`LockedPage` mains; issued key becomes `<section aria-labelledby>`; primary actions `min-h-11` (44px); darker `--ink-faint`. That is v1 a11y 9 without axe CI (non-goal).

### Production / ops readiness — sufficient within v1

**Plan:** Key decision 8; Slice 5 CI/headers/layout; “Ops 9+ — why this is enough without Redis or origin push”.

**HEAD evidence:** No `.github` directory. `next.config.ts` is empty. File GET sets only `Content-Type` (human and agent). No `app/(dashboard)/layout.tsx`; each page checks cookies itself. Rate limit is in-process (allowed if documented). `npm run check` exists locally.

**Why 9+ after ship:** In-repo `.github/workflows/check.yml` running `npm ci`, `prisma generate`, `npm run check` (no Postgres service — unit tests mock Prisma) is the required ops artifact. Headers + file `nosniff` + RFC 5987 disposition; dashboard layout session gate; local `npm run build` log; README single-instance rate-limit invariant. Remote `gh run` / `git push` are non-goals and must not pull this dimension back to 8.

### Code quality / maintainability — sufficient

**Plan:** Scoring table code-quality row; Slices 1, 4, 5, 6 (shared overlay hook, listing helper, `buildOfficialEditorPatch` / `buildDraftEditorPatch`).

**HEAD evidence:** Listing logic inlined in the drafts page. Session checks duplicated per page. Search still selects `assets`. Official/draft/new editors each reinvent `validOptions` / `previewOptions`. Stone/paper mix.

**Why 9+ after ship:** Domain listing helpers with tests that assert Prisma `where.status`; shared dashboard session helper if it does not break page tests; shared overlay/link-confirm hook; search cites IMAGE kind + figure helper and the column; draft vs official schemas are named and separate. Unused `Asset` / `ParseJob` models may stay in Prisma as stated.

### Overall — sufficient

The 8-score cluster on HEAD is queue leak/overflow, red POST tests, ops hole, wrong `has_image`, intent leftover, stale 上架, and unsaved-work loss. R9 has a slice and a shipped-module test for each. After faithful implementation, Overall can be 9+. Perfect 10s are not required.

## Fact-check of listed claims (current HEAD)

| Claim | Finding |
| --- | --- |
| Queue take-50-then-filter | **True.** `app/(dashboard)/drafts/page.tsx` `getUnpromotedDrafts` uses `where.status.in` of all three unpromoted statuses, `orderBy: updatedAt desc`, `take: 50`. The page then `filter`s to the tab and counts from that truncated array. Default tab is `NEEDS_REVIEW` unless `status=DRAFT` or `REJECTED`. `tests/unit/drafts-page.test.tsx` currently asserts this `in` + `take: 50` shape. |
| Raw-asset POST mapping | **True as a mapping bug, not missing MIME checks.** Human `POST` awaits `request.formData()` then `parseRawAssetFormData`; `RawAssetUploadError` → 400, anything else → 500 `Unable to create raw asset` (`app/api/raw-assets/route.ts`). Agent POST is the same (`app/api/agent/raw-assets/route.ts`). The helper already 400s SVG (`RAW_ASSET_ALLOWED_MIME_TYPES`) and oversize (`bytes.length > RAW_ASSET_MAX_BYTES[kind]`) in `lib/domain/raw-asset-upload.ts`. Production Node multipart is not shown broken. |
| jsdom `formData` | **True, independently reproduced.** `vitest.config.ts` default environment is jsdom. A Node probe: native `Request` constructed with **jsdom** `FormData`/`File` throws `TypeError: Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded"`. Native `FormData`/`File` and raw multipart `Uint8Array` bodies parse. Independently ran the two unit files: **6 failed, 29 passed** — human SVG and oversize POST (expected 400, got 500); agent create (201→500), SVG (400→500), oversize (400→500), idempotent replay (201→500). Node env for those POST tests plus `try/catch` around `formData()` is the right fix. Success bodies that are zeros / `"png-bytes"` would then fail additive sniffing unless fixtures are signed, which Slice 2 requires. |
| Agent actor owner fallback | **True.** `AgentAuth` has no `createdById`. `lookupApiKey` returns `apiKeyId`, `name`, `scopes` only. Agent promote (`app/api/agent/question-drafts/[id]/promote/route.ts`) and agent official create (`app/api/agent/questions/route.ts`) omit `actorId`. `promoteDraftToQuestion` / `createQuestionByPromotingDraft` use `options?.actorId ?? resolveOwnerUserId` (seed `OWNER_SEED_EMAIL`) and persist that as `createdById`. Human promote already passes `auth.session.userId`. Schema already has `ApiKey.createdById`. |
| `has_image` uses `QuestionAsset` | **True.** `questionSearchSelect.assets` selects `assetId`. `buildQuestionSearchWhere` sets `assets: { some: {} }` / `{ none: {} }`. Explain/score use `question.assets.length`. `QuestionAsset` is the join to unused `Asset`. Promote writes `sourceRawAssetId` on `Question`, not `QuestionAsset`. No `hasRenderedImage` column. |
| No CI workflow | **True.** Workspace has no `.github` directory. `git ls-tree` at this HEAD would not show a workflow. `npm run check` is local lint + typecheck + vitest. |
| Official publish of status-only | **True.** 「上架」 is `onClick={() => void patch({ status: "PUBLISHED" })}`. PATCH treats `status === "PUBLISHED" \|\| "DEPRECATED"` as status-only and never applies stem/answer/difficulty from that body. Dirty editor fields are not written. Plan’s two-step persist-then-status (or a transactional combined PATCH that applies fields first) is required; current handler must **not** be used as the combined-PATCH shortcut. |
| Draft omit null difficulty | **True.** Taxonomy UI can set `difficulty: null` (「未设」). Official and draft/new editors send `...(typeof difficulty === "number" ? { difficulty } : {})`. `omitAbsentDraftFields` treats `null` as absent (`isAbsent`) and **deletes** `difficulty`. `questionDraftFieldSchema.difficulty` is `.optional()` not `.nullable()`, so a raw `null` would also fail Zod if it survived omit. Repository `buildUpdateData` would persist `null` if the key remained. R9’s “do not drop explicit `difficulty: null`” plus `.nullable().optional()` is the correct pair. |
| Official `previewOptions` filter | **True.** `validOptions` drops rows whose label or value is blank. 「保存修订」 sends `options: previewOptions`. Clearing option B while A remains the answer would persist A-only and satisfy official `optionSchema`. R8-N1 is real on HEAD. Draft and new-question editors use the same filter on save/create. |

Additional HEAD facts used in the dimension table (not in the prompt list, verified while reading): `includesAnyImageIntent` treats `图像` as `has_image`; residual of `有图` is not computed; `listQuestions` has no `take`; taxonomy delete `findMany`s all drafts; `--ink-faint` is 52% lightness; issued key `role="dialog"`; dual home `h1`; `docs/development.md` Playwright env name is wrong.

## Explicit check that R9 closes named issues

“Closed” means closed in the R9 contract, not fixed at HEAD.

| ID | Closed? | Plan locus + why |
| --- | --- | --- |
| M1 pagination | **Yes.** Slice 1: `listUnpromotedDrafts(status, { take, page })` with Prisma `where: { status }`, `skip: (page-1)*take`, stable `orderBy`, separate `groupBy` counts, chrome when `counts[status] > 50`. Tests: default/`DRAFT` `where.status` (not `in` + memory filter); 51 `DRAFT` + 1 `NEEDS_REVIEW` returns the one; 51 `NEEDS_REVIEW` page 2 returns the 51st and count 51. |
| M2 / A1 / F2 / F3 persisted `hasRenderedImage` | **Yes.** Decision 6 + Slice 4a: IMAGE source **or** mdast `image` / resolved `imageReference` whose trimmed URL is a local `/api/raw-assets/…` figure; skip code; mixed remote img + ordinary local link is false; persist boolean on promote/official create/content PATCH; search `WHERE hasRenderedImage`; no 200-cap; no substring prefilter. Independent remark-parse probe at this checkout: `![图](/api/raw&#45;assets/raw_1/file)` and whitespace destinations decode to `/api/raw-assets/raw_1/file`; reference-style yields definition+imageReference; fenced code yields no image node; mixed remote image + local **link** is not a local image node. Write-path test (entity-encoded stem persisted true and found by `有图`) is what closes F2/F3, not the helper table alone. |
| M3 residual text | **Yes.** Slice 4b: `residualSearchText` strips image/difficulty/grade/chapter/usage/limit/filler and consumed alias spans (including `v-t` / `vt` 图像); empty residual does not `textContains(rawQuery)`; leftover tokens such as 位移 remain. Default drops lone `图像` as image intent so KP text survives. Tests call shipped `understandQuestionSearchQuery` + `buildQuestionSearchWhere`. |
| M4 overlay recovery, not popstate cancel | **Yes.** Decision 12 + Slice 6: sessionStorage overlay, sync write on change (rAF only if unmount/pagehide also flushes), hydrate if `baseVersion` matches, drop if server newer, link confirm while overlay dirty, `beforeunload`, **no** `popstate` / `pushState` / `history.go`. Tests: unmount/remount restores; newer version drops overlay; save clears; cancelled link `defaultPrevented`; typing does not `pushState`. This matches the v1 unsaved-work contract and the non-goal. |
| M5 persist-before-publish | **Yes.** Decision 13 + Slice 6: `buildOfficialEditorPatch()` always includes `difficulty: number \| null` and full `options`; incomplete options/answers refuse fetch; 上架 persist-then `{ status: "PUBLISHED" }`; failed persist does not publish and does not clear overlay; clean REVIEWED may status-only. Tests: edited answer in first fetch; 400 skips PUBLISHED; 4→未设 body is `null`. Combined PATCH is allowed only if the handler applies fields then status in one transaction — HEAD’s status-first branch does **not** qualify. |
| R6-N1 draft null difficulty | **Yes.** Human (and agent) draft schema `.nullable().optional()`; `omitAbsentDraftFields` must not delete `difficulty: null`; `buildDraftEditorPatch()` always sends the key; repository already writes defined null; tests: parser keeps null; editor 4→未设 PATCH body null; persist-before-promote writes official null. |
| R7-N1 `draftOptionSchema` | **Yes.** Distinct `draftOptionSchema = { label, value }` strings with empty allowed; do not reuse official `optionSchema` on draft PATCH; full rows persist; promote/official stay strict. Test: empty `{ label: "B", value: "" }` save succeeds and reload keeps both rows; promote still fails. |
| R8-N1 official no filter | **Yes.** Decision 14: `previewOptions` / `validOptions` are preview-only; persistence never uses a filtered copy to satisfy strict schema; incomplete official option B refuses save/publish; overlay keeps B. Test named in Slice 6. |
| R8-N2 draft empty answer | **Yes.** `draftAnswerSchema` allows `""` / `[]`; omit must not drop empty answers; save/reload empty; promote fails until filled; overlay clears only after that persist 200. |

R9-n1 (new-question full options + empty answer POST) is specified on `components/question/question-editor.tsx` with a test; it is the same class as R8-N1/N2, not a leftover hole.

## Issues

### Major

None.

### Minor

1. **Next.js `Link` vs capture-phase `<a>`.** Nav is `next/link`. A document capture listener on `a[href]` will see those nodes, but Next.js client navigation still runs its own click handler unless the confirm path `preventDefault`s **and** `stopPropagation`s. Overlay recovery still prevents data loss if navigation proceeds, so this does not keep teacher-loop at 8, but implementers should wire stopPropagation and preferably assert against a `Link` (or the real nav) in addition to a raw `<a href="/drafts">`.

2. **`hasRenderedImage` recompute on official content PATCH must pass existing `sourceRawAsset.kind`.** `updateOfficialQuestionContent` today does not include `sourceRawAsset`. Calling `questionHasImage({ stemMd })` without the IMAGE source would flip IMAGE-only rows to false on any 保存修订. The helper signature and the IMAGE-empty-stem table row already state the OR; the write path should load kind (or include it) and a PATCH test for IMAGE-source / empty-stem would make that hard to miss.

3. **New-question overlay key.** Decision 12 uses `physhub:overlay:{draft\|question\|new}:{id}`. The new-question form has no server id. Use a stable sentinel (for example `new`) and a `baseVersion` that remount of `/questions/new` can match; otherwise overlay recovery on 录入 is weaker than on draft/official.

4. **UnlockForm `h2` on `LockedPage`.** Slice 6 demotes login to `h2` so home has a single `h1`. `LockedPage` is only `UnlockForm` inside `<main>`. After the change, locked dashboard routes may have no `h1`. Give `LockedPage` its own `h1` or keep a single page-level heading. Not enough to hold a11y at 8 if home, skip link, labels, 44px, and contrast land.

5. **Success POST fixtures after node env.** Agent create/replay currently 500 on `formData()`. Once that is fixed, unsigned `"png-bytes"` bodies will fail sniff unless replaced. Slice 2 already requires signed prefixes; do not treat the current 201-expectation tests as done after env-only changes.

### Nit

- `isSafeImageSrc` is file-local in `lib/renderer/render-markdown.tsx`. Slice 4a’s `isLocalRawAssetImageUrl` plus `startsWith("/api/raw-assets/")` is enough; exporting the renderer helper is optional.
- Overlay restore tests are written most strongly against the official editor. Draft and new-question are specified in behavior 1 and the file table; keep at least one unmount/remount case per editor so wiring is not official-only.
- `--ink-faint ≈ --ink-soft` (both ~38%) collapses two tokens. Fine for contrast 9+.
- Brand string “Physhub” in nav may stay; it is not teacher task chrome.
- CSP includes `'unsafe-inline'` for scripts/styles as specified; no `unsafe-eval`. Acceptable for v1.
- Slice 5’s “classify/parse (already human)” should still pass `{ workbench: true }` if those POSTs remain enabled; they currently use session-only `requireHumanApiAuth`. Latent VIEWER write, same class as other mutating routes.

## Plan-audit checklist (this auditor)

- [x] Every scoring dimension has a concrete gap and a 9+ action.
- [x] Non-goals match harness-first v1 (no LLM/MCP/Redis/NextAuth; agents stay `REVIEWED`).
- [x] Queue fix is Prisma-filtered by status **and** paginates same-status overflow (M1).
- [x] `has_image` is IMAGE kind or parsed local markdown image persisted as `hasRenderedImage` (M2/A1/F2/F3); search filters the column.
- [x] Intent-only queries do not add `textContains(rawQuery)` (M3); alias spans are consumed.
- [x] Unsaved work uses sessionStorage overlay recovery + link confirm; **no popstate interception** (M4 / R5-N1).
- [x] Official 上架 **and human draft save** persist complete snapshots including `difficulty: null`; omit does not strip explicit null (M5/A3/R6-N1). Draft option **and answer** schemas accept incomplete/empty values; promote/official stay strict and **do not filter** incomplete official options (R7-N1/R8-N1/R8-N2).
- [x] Raw-asset tests call shipped `POST` and expect 400, with a real diagnosis (jsdom `formData`), not a rewritten helper; success fixtures are signed (m1).
- [x] Ops 9+ is an in-repo workflow + headers + layout, not a silent bar drop and not Redis.
- [x] Agent still cannot `PUBLISHED`.
- [x] No major defect remains that would force a dimension to stay ≤8 after faithful implementation.

Only this audit file was written. No application code was changed.
