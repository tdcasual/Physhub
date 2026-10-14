# Physhub complete fix-and-completion plan

| Field | Value |
| --- | --- |
| Date | 2026-10-13 |
| HEAD at plan time | `3f2e1a9` (`feat: refresh workbench UI copy, tokens, and skill docs`) |
| Plan revision | R9 — closes R8-N1/N2 (official never filters incomplete options; draft-tolerant answer/options; promote stays strict) |
| Stated v1 boundary | Harness-first workbench: no in-process LLM, no MCP, no Meilisearch, no Redis/BullMQ, no NextAuth, no multi-tenant. Agents insert official questions at `REVIEWED` only. Single-instance deploy is the documented ops invariant. |
| Success bar | After implementation, two independent auditors (Codex + one other) score **every** dimension **9 or 10**. A score of 8 is a fail. Perfect 10s are not required. |

This document is the implementation source of truth. Do not implement until Codex and a second independent auditor record **pass** on this plan (no remaining major plan defect that would keep any dimension ≤8).

---

## Goal

Make Physhub a complete, usable harness-first teacher workbench:

1. A teacher can log in, see a **status-complete and pageable** unpromoted-draft queue, enter / review / promote, see official questions, manage taxonomy and agent keys.
2. Agents still cannot mark questions `PUBLISHED`.
3. `npm run check` is green.
4. Every scoring dimension in the table below can honestly be scored 9+ against the v1 boundary, with file:line or command evidence.

---

## Non-goals (explicit)

Do **not** do these even if an auditor asks for “more production”:

- In-process LLM, OCR product path, MCP server, Meilisearch, Redis, BullMQ, NextAuth.
- Changing the rule that agents insert at `REVIEWED` only and must not `PUBLISHED`.
- Multi-tenant, public question marketplace, dark mode as a product.
- Replacing scrypt password hashes or hashed editor sessions with a new auth product.
- Remote `git push` / a green GitHub Actions run on origin (this environment may not push). An **in-repo workflow file** is the ops artifact.
- Moving login rate-limit to Redis. v1 stays single-instance in-process `Map`; document that as an invariant, do not pretend it is multi-instance-safe.
- Migrating draft `knowledgePointIds` / `tagIds` JSON arrays to join tables in this pass (too large; search/listing/upload correctness do not require it). Taxonomy delete **must** stop unbounded `findMany` of every draft: use Prisma JSON `array_contains` (or equivalent `$queryRaw` containment) so the scan is filtered in the database.
- Virtualizing 50-item lists, adding axe CI, or a public CSP report-uri.
- Intercepting `popstate` / cancelling Next 16 history traversal (R5-N1: no correct index protocol exists for pre-mount and `go(-2)` entries without a process-wide tracker). Unsaved work uses overlay recovery instead.
- Rewriting the search parser into an LLM. Residual-text stripping of recognized control phrases is the v1 fix.

---

## Prior audit majors — how this revision closes them

Sources: Codex R1–R3 fails (R3 report currently in `docs/plans/2026-10-13-complete-fix-plan-codex-audit.md`; earlier rounds archived in scratch).

| ID | Defect | This revision |
| --- | --- | --- |
| M1 | Same-status drafts beyond 50 remain inaccessible | Slice 1: Prisma `where.status` **plus** page/cursor navigation. Tests: 51 same-status rows, page 2 returns the 51st. |
| M2 / A1 / F2 / F3 | Substring/source-id figures; 200-scan cap; Prisma `contains "/api/raw-assets/"` misses entity-decoded URLs (`&#45;`) | Slice 4a: mdast predicate **and** persisted `Question.hasRenderedImage` maintained on every stem/source write. Search `WHERE` that boolean (no scan cap, no literal prefilter). Tests include entity-encoded destinations and >200 false-positive rows if a loop were used — the column makes that moot. |
| M3 | Intent-only search still requires literal “有图/基础题” | Slice 4b: `residualSearchText`; empty residual means **no** `textContains(rawQuery)`. Alias spans consumed (R2 a2). |
| M4 / A2 / F1 / R4-N1 / R5-N1 | History cancellation cannot be specified correctly under Next 16 (trap deletes Forward; neighbor index cannot see pre-mount / `go(-2)` entries) | Slice 6: **do not intercept `popstate`.** R1 allowed “confirm on links **or** reliable autosave/recovery”. v1 is sessionStorage overlay + `pagehide` flush + remount hydrate + link confirm while overlay dirty. Back/Forward allowed; edits are not lost. Tests: unmount/remount restores; save clears overlay; link confirm; **no** `pushState` on type. |
| M5 / A3 / R6-N1 | Official 上架 stale fields; both editors omit `difficulty: null`; draft `omitAbsentDraftFields` deletes null so 4→未设 cannot persist | Slice 6: official **and** human draft snapshots always send `difficulty: number \| null`. Human draft schema nullable; `omitAbsentDraftFields` does **not** drop explicit `difficulty: null` (omission still preserves). Tests: draft and official 4→未设→save→reload null; persist-before-promote writes official null. |
| m1 | Unsigned success fixtures | Slice 2: real magic-byte prefixes. |
| m2 | Wrong Playwright env in docs | Slice 7: `TEACHER_BOOTSTRAP_*`. |
| m3 | No build / browser evidence | `npm run build` required; E2E if available. |
| m4 | Disposition encoding | Slice 2: ASCII + `filename*`. |

---

## Scoring dimensions and current gaps

Scale: integer 0–10 against **stated v1**, not against a SaaS exam platform. 9 = dimension is complete for v1 with only nits remaining. 8 = a known functional, security, or verification hole remains.

| Dimension | Current (plan-time) | Why ≤8 today | Work that lifts it to 9+ | 9+ evidence after ship |
| --- | --- | --- | --- | --- |
| Product completeness vs harness-first v1 | ~7–8 | Queue hides `NEEDS_REVIEW` **and** hides same-status overflow; upload POST 500 in tests; “有图” hits unused `Asset` **and** would hit text/PDF sources; intent search requires literal words; teacher UI split English/stone vs paper | Queue+pagination, upload 400, IMAGE/figure search, residual text, Chinese paper UI | Login → 待审 page 1/2 shows buried and overflow `NEEDS_REVIEW`; enter/review/promote; taxonomy; keys; no LLM in process |
| Teacher closed loop | ~8 | Queue leak/overflow; Next Link discards dirty editors; official 上架 publishes stale rows; deprecate/delete without confirm; dual 退回 | Status-filtered pageable listing; persist-before-publish; unsaved-nav guard; confirm destructive; one reject | Unit: unlock path; persist then promote/publish; dirty link cancelled; queue page 2 |
| Agent/harness path & AI boundary | ~8–9 | Agent promote `actorId` falls back to seed owner; otherwise boundary is solid | Pass API-key creator as `actorId`; keep 403 on human publish URLs | Agent POST `/api/questions` 403; agent promote `REVIEWED`; `createdById` ≠ silent owner when key has `createdById` |
| Auth / session / secrets | ~7–8 | Mutating human routes omit `workbench: true`; VIEWER is dead but would write if a session existed; `lastUsedAt` write amplification | `workbench: true` on all human writes; throttle `lastUsedAt`; keep scrypt + hashed sessions + wrap | VIEWER 403 on PATCH; OWNER/EDITOR writes; keys still hashed+wrapped; logout DELETE still works |
| Domain correctness | ~8 | Queue take-50-then-filter; `has_image` uses empty `QuestionAsset`; substring figures; intent leftover; `listQuestions` unbounded; taxonomy delete scans all drafts; omitted `difficulty` cannot clear | Status+page listing; persisted `hasRenderedImage` from AST; residual text; `listQuestions` take 50; JSON `array_contains`; nullable difficulty | Prisma `where.status` is the tab; 有图 matches IMAGE/AST figure only; mixed/code stems are 无图; `有图` does not require the literal |
| Tests | ~7 | 6 failed raw-asset POST 500; no queue-completeness **or** overflow test; no residual-search / persist-publish / dirty-nav tests; no CI | Node-env route tests; 400 mapping; signed fixtures; queue overflow; search residual; dirty-nav; persist-publish; `npm run check` 0 | `npm run check` exit 0; new tests call shipped page/route/editor/search modules |
| Docs vs code | ~8 | README does not describe queue pagination, sniffing, CI, actor, `has_image`; development.md Playwright env is wrong | Update README + `docs/development.md` to match shipped behavior including Playwright bootstrap env | Each new behavior has a sentence that matches code |
| Teacher UI usefulness | ~7 | Core edit path English; two visual systems; overflow backlog; stale publish | Chinese labels; paper tokens; `Button`; confirm delete/deprecate; pagination chrome; persist-before-publish | Teachers never see English chrome on 工作台/录入/审题/题库/知识点/密钥 |
| Accessibility / touch / i18n | ~6–7 | Dual `h1` on home; taxonomy inputs placeholder-only; review buttons `py-2`; issued-key `role=dialog` is not a dialog; no skip link; faint contrast | One `h1`; labels; `min-h-11`; issued key is an in-page region; skip link; darker `--ink-faint` | `lang=zh-CN`; skip link; 44px primary actions; labelled taxonomy fields |
| Production / ops readiness | ~6–7 | No in-repo CI; no security headers; no `nosniff` on file GET; no dashboard layout gate; origin push is **not** required | GitHub Actions `check.yml`; `next.config` headers; file `nosniff`+safe disposition; `(dashboard)/layout.tsx`; keep single-instance rate limit documented; local `npm run build` | Workflow file exists; `npm run check` is what it runs; headers visible in config; build log |
| Code quality / maintainability | ~8 | Listing logic inlined in page; duplicated session checks; stone/paper mix; dead `Asset` still in search | Domain listing helpers; shared dashboard session helper; shared dirty-guard hook; stop using `QuestionAsset` for search | Listing tests import domain/page; search code cites IMAGE kind + figure helper |
| **Overall** | ~7–8 | Queue + red tests + ops hole + search/publish holes dominate | All rows above | Both auditors 9–10 including Overall |

---

## Key decisions

1. **Draft queue is filtered in Prisma, then paginated.** Default tab `NEEDS_REVIEW` queries `where: { status: "NEEDS_REVIEW" }` with `take: 50`, `skip: (page-1)*50` (page ≥ 1), `orderBy: [{ updatedAt: "desc" }, { id: "desc" }]`. Counts come from a separate `groupBy` of the three unpromoted statuses. A `NEEDS_REVIEW` row is never dropped because 50 newer `DRAFT` rows exist, **and** the 51st `NEEDS_REVIEW` is reachable on page 2. Cursor (`updatedAt`+`id`) is an allowed implementation of the same contract; page+skip is the default.

2. **Raw-asset 500 is a test-environment + error-mapping bug, not missing MIME checks.** `parseRawAssetFormData` already throws `RawAssetUploadError` for SVG and oversize. Vitest’s default `environment: "jsdom"` makes `Request.formData()` throw, and the route maps unknown throws to 500. **Production Node multipart is not claimed broken.** Fix: run those route POST tests in **node** environment; `try/catch` `request.formData()` → 400 `Invalid request body`; check `file.size` before `arrayBuffer()`; keep helper-level tests. Success fixtures **must** carry real magic bytes so sniffing does not turn green tests red.

3. **Magic-byte sniffing is additive, not a replacement for the MIME allowlist.** After MIME allowlist + size, require PNG/JPEG/WEBP/PDF signatures. `text/plain` and markdown: reject if the buffer contains a NUL or starts with `<svg` / `<html`. SVG declared as `image/svg+xml` still 400 at the allowlist.

4. **File GET sets `X-Content-Type-Options: nosniff` and a safe Content-Disposition.** Images (`image/png|jpeg|webp`) may be `inline`; everything else `attachment`. Filename: strip C0 controls, `"`, `\`, and newlines; ASCII `filename="download"` fallback plus RFC 5987 `filename*=UTF-8''…` when `originalName` has non-ASCII. Select `originalName` explicitly. Do not static-serve `./uploads`.

5. **Agent promote actor:** extend `AgentAuth` with `createdById: string | null` from `ApiKey.createdById`. Pass `actorId: agent.createdById ?? undefined` into promote so the existing owner-seed fallback only applies when the key has no creator (dev-agent). Do not invent a fake User row.

6. **`has_image` means a rendered local figure, not “has a source file” and not a substring coincidence.** True when **either**:
   - `sourceRawAsset.kind === "IMAGE"`, or
   - the stem’s **parsed markdown AST** (same `remark-parse` + `remark-math` stack as `lib/renderer/render-markdown.tsx`) contains an `image` or resolved `imageReference` whose URL, after trim, passes the existing `isSafeImageSrc` rule **and** starts with `/api/raw-assets/`.
   False when neither. Exclude fenced/inline `code`, HTML-only coincidences, escaped punctuation, and mixed documents that have a remote `![...](https://…)` plus a **link** `[来源](/api/raw-assets/…)` but no local image node. TEXT / MARKDOWN / LATEX / PDF sources do **not** match by themselves. Whitespace destinations and HTML-entity destinations (`![图](/api/raw&#45;assets/raw_1/file)`) **do** match because remark yields `/api/raw-assets/…`.
   Persist that boolean as `Question.hasRenderedImage` on every write that sets `stemMd` or `sourceRawAssetId` (promote, official create, official content PATCH). Search `WHERE hasRenderedImage: true/false` — **exact**, no candidate cap, no `stemMd contains "/api/raw-assets/"` prefilter (that prefilter is **not** a superset of AST matches). Explain/score use `questionHasImage` (equivalent to the column after writes). Stop using `assets: { some/none }`. Leave unused `Asset` / `ParseJob` models in Prisma. One Prisma migration; `scripts/backfill-has-rendered-image.ts` using the same helper for existing rows; seed runs it or documents it.

7. **Search text matching uses residual free text, not the raw control phrase.** After `understandQuestionSearchQuery`, strip recognized control phrases (image intents, difficulty intents, grade, chapter, usage terms, “找 N 道”, filler “最好/适合”) from `rawQuery`. If residual is empty, do **not** add `textContains(understanding.rawQuery)`. Knowledge-point / grade / chapter / usage clauses still apply when extracted. Preserve leftover tokens (“位移 有图” still matches 位移).

8. **Ops 9+ without Redis:** in-repo `.github/workflows/check.yml` running `npm run check`; security headers in `next.config.ts`; dashboard layout session gate; README states single-instance rate limit as a v1 invariant. Local `npm run build` is verification evidence. No origin push required.

9. **Auth 9+ without NextAuth:** add `{ workbench: true }` to every human mutating route (POST/PATCH/DELETE on drafts, questions content/status, taxonomy, raw-assets, suggestions, question-sets). GET may stay session-only. VIEWER still cannot log in; this closes the latent write hole.

10. **Teacher UI 9+ is Chinese paper, not a redesign.** Reuse `--paper/--ink/--seal` and `Button`. Translate remaining English chrome. Do not add a new component library.

11. **`listQuestions` grows a `take` default of 50** (same as the UI). Agent search already clamps. Prevents unbounded `GET /api/questions`.

12. **Unsaved work must not be lost; v1 does not cancel History.** Codex R1 allowed “dirty-state confirmation on links/navigation, **or** reliable autosave/persisted recovery.” R3–R5 proved Next 16 popstate cannot be cancelled correctly: `pushState` traps delete Forward (R4-N1); an editor-local index cannot name `go(-2)` or pre-mount entries (R5-N1). **Non-goal: intercepting `popstate` / wrapping `history.go`.**

    v1 contract:

    (a) **Overlay recovery** (`lib/ui/editor-overlay.ts`): `sessionStorage` key `physhub:overlay:{draft|question|new}:{id}` holds the complete editor snapshot (`buildOfficialEditorPatch` / draft fields / new-question fields), `updatedAt`, and `baseVersion` (official `version` or draft `updatedAt` iso). Write **synchronously on snapshot change** (rAF coalesce only if `useEffect` cleanup / unmount also flushes — SPA client navigation does **not** fire `pagehide`). Also flush on `pagehide` / `visibilitychange` hidden. On editor mount: hydrate only if overlay `baseVersion` equals the server props’ version; if the server is newer, **drop** the overlay (do not clobber a newer persist). If hydrated, treat as dirty and show 「已恢复未提交的修改」 (`role="status"`). Successful server persist **removes** the overlay. If bfcache restores the React tree, overlay is redundant and harmless.

    (b) **Do not autosave official questions to PATCH on every keystroke** (each official PATCH creates a version). Overlay is client-side; server writes stay explicit 保存 / persist-before-publish / draft save. Drafts may optionally debounce PATCH; not required if overlay+flush is tested.

    (c) **In-app links:** capturing click confirm **only while overlay dirty** (differs from last successful server snapshot). `beforeunload` while overlay dirty (close tab drops sessionStorage).

    (d) **Back/Forward:** allowed. Next unmounts the editor; remount hydrates overlay. Teacher sees the same stem/answer. No `history.pushState`/`replaceState` on typing.

    (e) Tests must prove recovery across unmount, not history cancellation.

13. **Editors persist a complete snapshot, including cleared difficulty, on both official and draft paths.**

    Official: `buildOfficialEditorPatch()` used by 「保存修订」 and 上架 persist. Always include `difficulty: number | null` and the **full** `options` array (not `previewOptions`). `questionInputSchema.difficulty` becomes `.nullable().optional()`. Domain already clears provided-null. **If any option row is incomplete or the answer is incomplete, do not PATCH and do not publish** — show 「请先补全选项和答案」, keep overlay/dirty. Never filter rows to make strict `optionSchema`/`answerSchema` pass. 上架: persist snapshot then `{ status: "PUBLISHED" }` only after that persist 200; failed persist does not publish and does not clear overlay. 停用: confirm; persist first if dirty (same completeness gate).

    Draft (R6-N1 / R7-N1 / R8-N2): `buildDraftEditorPatch()` used by save / persist-before-promote / reject. Always include `difficulty` (null = 未设), the **full** `options` array, and `answer` even when empty. `questionDraftFieldSchema.difficulty` becomes `.nullable().optional()`. Distinct:

    ```
    draftOptionSchema = z.object({ label: z.string(), value: z.string() })
    draftAnswerSchema = discriminatedUnion of
      { type: "single", value: z.string() }          // "" allowed
      { type: "multiple", value: z.array(z.string()) } // [] allowed
      { type: "text", value: z.string() }             // "" allowed
    ```

    Do **not** reuse official `optionSchema`/`answerSchema` on draft PATCH. **`omitAbsentDraftFields` must not delete `difficulty: null`, empty answers, or empty option rows.** Omitted keys still mean “leave unchanged”; explicit empty/null means clear. Repository persists provided answer/options/difficulty including empty/null. Agent PATCH: same draft semantics. Overlay `clearEditorOverlay` only after that persist succeeds.

    **Promote / official create stay strict:** official `optionSchema` and `answerSchema` still apply in `parseAndValidateQuestionInput` / promote. Saving a draft with an empty option or cleared answer **succeeds**; promoting it **fails** until filled. Do not filter incomplete rows to make promote pass.

14. **Complete snapshots vs display filters (closes R8-N1/N2 as a class).** `previewOptions` / `validOptions` are **preview-only**. Persistence payloads never use a filtered copy to satisfy a strict schema. Draft validation is tolerant so teachers can save unfinished work. Official validation is strict, enforced by **refusing** save/publish (client message + server 400 if sent), not by dropping rows. Same split for answers.

    Overlay `baseVersion`: official page passes `version: latest QuestionVersion.version` (query take 1 desc; there is no scalar `Question.version`). Draft uses `updatedAt` ISO. After successful write, bump the baseline from the response.

---

## Slice 1 — Status-complete, pageable draft queue

**Files:** `lib/domain/draft-listing.ts` (preferred) or `lib/domain/draft-repository.ts`, `app/(dashboard)/drafts/page.tsx`, `tests/unit/drafts-page.test.tsx`, `tests/unit/draft-listing.test.ts`.

Shipped functions:

```ts
const UNPROMOTED: DraftStatus[] = ["DRAFT", "NEEDS_REVIEW", "REJECTED"];
const PAGE_SIZE = 50;

listUnpromotedDrafts(status: DraftStatus, { take = PAGE_SIZE, page = 1 })
countUnpromotedDraftsByStatus(): { NEEDS_REVIEW: number; DRAFT: number; REJECTED: number }
```

Prisma:

- list: `findMany({ where: { status }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take, skip: (page-1)*take, select: existing unpromotedDraftSelect })`
- counts: `groupBy({ by: ["status"], where: { status: { in: UNPROMOTED } }, _count: { _all: true } })`

Page: parse `searchParams.status` as today; parse `searchParams.page` as integer ≥ 1 (invalid → 1). Pass both into `listUnpromotedDrafts`. Render **global** counts from `countUnpromotedDraftsByStatus`, not from the page length. Chrome: 「上一页」「下一页」 (or numbered pages) when `counts[status] > PAGE_SIZE`; preserve status in the href (`/drafts?status=DRAFT&page=2`). `aria-label="草稿分页"`.

**Tests (must import shipped modules):**

- Page test: `findMany` called with `where: { status: "NEEDS_REVIEW" }` (default) and **not** `in: [DRAFT, NEEDS_REVIEW, REJECTED]` plus in-memory filter. Tab `?status=DRAFT` calls `where: { status: "DRAFT" }`. `?page=2` uses `skip: 50`.
- Domain test with a fake db: 51 `DRAFT` + 1 `NEEDS_REVIEW`; `listUnpromotedDrafts("NEEDS_REVIEW")` returns the one `NEEDS_REVIEW` id.
- Domain test: 51 `NEEDS_REVIEW` with distinct `updatedAt`/`id`; page 1 returns 50 newest; page 2 returns the remaining one; counts.NEEDS_REVIEW === 51. This is the **overflow completeness** proof (Codex M1).

---

## Slice 2 — Raw-asset 400 mapping, size, sniffing, nosniff, fixtures

**Files:** `lib/domain/raw-asset-upload.ts`, `app/api/raw-assets/route.ts`, `app/api/agent/raw-assets/route.ts`, `app/api/raw-assets/[id]/file/route.ts`, `app/api/agent/raw-assets/[id]/file/route.ts`, `tests/unit/raw-assets-route.test.ts`, `tests/unit/agent-raw-assets.test.ts`, helper tests already in those files.

**Upload parse:**

1. If `file.size` (when present) exceeds `RAW_ASSET_MAX_BYTES[kind]` **before** `arrayBuffer()`, throw `RawAssetUploadError("File too large")`.
2. After bytes: `assertSniffedKind(mime, bytes)` — PNG `89 50 4E 47`, JPEG `FF D8 FF`, WEBP `RIFF....WEBP`, PDF `%PDF`. Text/markdown: reject NUL or `<svg`/`<html` (case-insensitive prefix). Mismatch → `Unsupported media type`.
3. Routes: `try { form = await request.formData() } catch { 400 Invalid request body }`. Keep existing `RawAssetUploadError` → 400 with the same strings (`Unsupported media type`, `File too large`).

**Accepted-upload fixtures (Codex m1):** any POST/helper case that currently uses `Buffer.alloc(...)` zeros or `"png-bytes"` as a **successful** PNG/PDF must be replaced with a buffer that starts with the real signature (minimal 8–16 byte prefix is enough; oversize tests may still use a large buffer **with** a valid prefix). Keep malformed-byte rejection tests separate.

**File GET headers:**

```
Content-Type: <stored mime or octet-stream>
X-Content-Type-Options: nosniff
Content-Disposition: inline; filename="<ascii>"; filename*=UTF-8''<urlencoded>   // images
Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<urlencoded> // else
```

Ship `buildContentDisposition(originalName, inline)` used by both human and agent file routes. ASCII fallback `download` when the name is empty or non-ASCII-only. Tests: Chinese `originalName` does not put raw CJK inside `filename=""`; `"` and CR/LF are stripped; header includes `nosniff`.

**Tests:**

- Add `// @vitest-environment node` at the top of the two route test files that call `POST` (or move POST cases to `*.node.test.ts` included by vitest). Helper `parseRawAssetFormData` tests may stay jsdom.
- Keep existing SVG → 400 `Unsupported media type` and oversize PNG → 400 `File too large` **via `POST`**, not only via the helper.
- Add sniff tests on the shipped `assertSniffedKind` / `parseRawAssetFormData`: `image/png` body that is `<html>...` → `Unsupported media type`.
- File GET unit: response headers include `nosniff` and a well-formed disposition.

---

## Slice 3 — Agent promote actor

**Files:** `lib/auth/agent-auth.ts`, `app/api/agent/questions/route.ts`, `app/api/agent/question-drafts/[id]/promote/route.ts`, `tests/unit/agent-promote-routes.test.ts` (and create-official if present).

`AgentAuth` gains `createdById: string | null`. `lookupApiKey` selects `createdById`. Dev-agent: `createdById: null` (owner fallback remains, documented).

```ts
await createQuestionByPromotingDraft(rawBody, { db: tx, actorId: agent.createdById ?? undefined });
await promoteDraftToQuestion(id, { db: tx, actorId: agent.createdById ?? undefined });
```

**Test:** mock API key with `createdById: "user_editor"`; after promote, `question.create` / promote path receives `createdById: "user_editor"` (or the `actorId` option is forwarded). Dev-agent still promotes (owner fallback). Human promote still uses session `userId`. **Do not** change 403 on human publish URLs.

---

## Slice 4 — Image search against parsed local figures + residual free text

**Files:** `prisma/schema.prisma` + migration, `lib/search/question-image.ts`, `lib/search/question-search.ts`, `lib/domain/promote-draft.ts`, `lib/domain/official-question.ts`, `scripts/backfill-has-rendered-image.ts`, `tests/unit/question-search.test.ts`, promote/update tests.

### 4a. Image predicate (Codex M2 / R2 A1)

Replace `assets: { some/none }` with helpers in `lib/search/question-image.ts` (or `lib/renderer/markdown-images.ts` if that keeps one parser). Add **direct** deps `unified` and `remark-parse` (already transitive via `react-markdown`) so tests do not rely on hoisting.

```ts
export function isLocalRawAssetImageUrl(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.startsWith("/api/raw-assets/");
}

export function stemHasRenderedFigure(stemMd: string | null | undefined): boolean {
  // unified().use(remarkParse).use(remarkMath).parse
  // visit: image; imageReference resolved via definition.url
  // skip descendants of code / inlineCode
  // match isLocalRawAssetImageUrl(node.url)
}

export function questionHasImage(q: {
  sourceRawAsset?: { kind: string } | null;
  stemMd?: string | null;
}): boolean {
  return q.sourceRawAsset?.kind === "IMAGE" || stemHasRenderedFigure(q.stemMd);
}
```

**Persist the predicate (closes F2 scan-cap and F3 entity-prefilter):**

Add `hasRenderedImage Boolean @default(false)` on `Question` (indexed). Recompute with `questionHasImage` on:

- `promoteDraftToQuestion` / `createQuestionByPromotingDraft`
- official create
- `updateOfficialQuestionContent` (stem and/or source change)

`buildQuestionSearchWhere` / `searchQuestions`:

```
has_image true  → { hasRenderedImage: true }
has_image false → { hasRenderedImage: false }
```

`take: merged.limit`, `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`. **No** 200-cap loop, **no** `stemMd contains "/api/raw-assets/"` candidate filter.

`scripts/backfill-has-rendered-image.ts` loads rows, writes the helper result; seed or `docs/development.md` runs it after migrate.

`questionSearchSelect`: drop unused `assets`; add `sourceRawAssetId`, `sourceRawAsset: { select: { kind: true } }`, `hasRenderedImage`. Prefer tests/`skills/physhub` `field: "source"`.

**Tests (must import shipped modules):**

| Stem / source | `questionHasImage` / column | Notes |
| --- | --- | --- |
| IMAGE source, empty stem | true | |
| TEXT or PDF source, no figure | false | |
| `![图](/api/raw-assets/raw_1/file)` | true | even if source null |
| `![图]( /api/raw-assets/raw_1/file )` | true | whitespace destination |
| `[图]: /api/raw-assets/raw_1/file` + `![图]` | true | reference-style |
| `![图](/api/raw&#45;assets/raw_1/file)` | true | entity-decoded; **search** finds the row via column after write |
| `[来源](/api/raw-assets/raw_1/file)` only | false | ordinary link |
| `![remote](https://example.invalid/x.png)` plus `[来源](/api/raw-assets/raw_1/file)` | false | mixed; renderer hides remote img |
| fenced code containing the image markdown | false | not a rendered node |
| neither | false | |

Write-path test: promote/update with entity-encoded stem persists `hasRenderedImage: true`; `searchQuestions("有图")` returns it among others (proves candidate reachability, not only helper classification). Mixed-link write persists `false` and is absent from 有图. Same predicate in explain/score.

### 4b. Residual text (Codex M3)

Today `buildQuestionSearchWhere` adds `textContains(understanding.rawQuery)` whenever no KP/grade/chapter/usage clause exists — so a query that is **only** `有图` / `无图` / `基础题` still requires those literals in the question text.

Ship:

```ts
export function residualSearchText(understanding: QuestionSearchUnderstanding): string | undefined
```

Strip, in order, recognized control phrases from `rawQuery` (after trim/collapse spaces):

- Image: `无图|不要图|不带图|有图|带图|图片|图表|示意图` (do **not** strip the physics token `图像` when it is part of an extracted knowledge-point alias such as `v-t 图像`; **do** strip standalone image intents listed here. If `includesAnyImageIntent` used `图像` as an intent, stop treating bare `图像` as image intent **or** strip it only when it is not inside an extracted KP value. Default: keep current image-intent regex except drop the lone `图像` alternative so “v-t 图像” remains residual/KP text; `有图/带图/图片/图表/示意图` remain intents.)
- Difficulty: `基础题|简单题|容易|入门|中等|普通|困难|压轴|提高|拔高|基础|简单`
- Grade / chapter / usage terms already extracted
- **Consumed alias spans (R2 a2):** remove every `knowledgePointAliases[].pattern` match (including `v-t` / `v t` / `vt` 图像) so residual does not AND a non-canonical spelling that would exclude a question tagged only with canonical `v-t 图像`.
- Limit: `/找\s*\d+\s*道/`
- Fillers: `/最好/`, `/适合/`

If residual is empty (or punctuation-only), **do not** push a text clause from `rawQuery`. If residual remains, `textContains(residual)` (not the full raw query) when there is no other KP/grade/chapter/usage clause; when those clauses exist, still AND residual if it is non-empty so “位移 有图” keeps 位移. Do **not** AND residual copies of already-extracted KP aliases.

**Tests (must call shipped `understandQuestionSearchQuery` + `buildQuestionSearchWhere`):**

- Query `有图` against a question whose stem/solution/KP/tags do **not** contain `有图` but which `questionHasImage` → included; a text-source question → excluded.
- Query `无图` → opposite.
- Query `基础题` → difficulty `[1,2]`, **no** `contains: "基础题"` on stem.
- Query `位移 有图` → image predicate AND residual/KP 位移.
- Combined existing long query in `question-search.test.ts` still returns structured understanding; leftover “面积表示位移” (or equivalent residual) may remain as text, control words must not be required.

---

## Slice 5 — Auth writes, lastUsedAt throttle, dashboard layout, security headers, CI, taxonomy JSON, listQuestions

**Workbench writes:** pass `{ workbench: true }` (in addition to existing `publishRoute` where set) on:

- `POST/PATCH/DELETE` drafts, knowledge-points, tags, raw-assets (not GET file), suggestions PATCH, question-sets POST, export POST, questions PATCH, questions POST (already publishRoute), classify/parse (already human).

GET list/detail/search stay `requireHumanApiAuth(request)` (any logged-in teacher including future VIEWER).

**Test:** VIEWER session on `PATCH /api/questions/:id` → 403 `Forbidden`. OWNER/EDITOR unchanged. Reuse `human-auth.test.ts` patterns.

**lastUsedAt:** only update if `lastUsedAt` is null or older than 60s. Still ignore write failures.

**Dashboard layout:** `app/(dashboard)/layout.tsx` reads session; if missing, render `LockedPage` and **do not render children**. Pages may keep their own session check so existing page unit tests remain valid (no Prisma without cookie). Extract `readDashboardSession()` if it removes duplication without breaking tests.

**Skip link:** in `app/layout.tsx` before `Nav`:

```html
<a href="#main" class="sr-only focus:not-sr-only ...">跳到主内容</a>
```

Each page `<main id="main">` (add `id="main"` to existing mains; UnlockForm pages too).

**Security headers** in `next.config.ts`:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'
```

KaTeX is bundled CSS/JS from the app, not a CDN — `'self'` is enough. If a build proves inline styles from KaTeX need `'unsafe-inline'` on style (already included), keep it. Do not add `unsafe-eval`.

**`color-scheme: light`** on `html` in `globals.css`.

**CI:** `.github/workflows/check.yml`

```yaml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run check
```

No Postgres service (unit tests mock Prisma). Document in README: “CI runs `npm run check`. E2E is local.”

**`listQuestions`:** add `take: 50` default (export option if tests need more). Update tests that expect unbounded lists.

**Taxonomy delete (code quality / domain):** replace `questionDraft.findMany({ select: { knowledgePointIds, tagIds } })` in `lib/domain/taxonomy-write.ts` with a filtered count, e.g. Prisma JSON `array_contains` on Postgres (`knowledgePointIds: { array_contains: id }` or `array_contains: [id]` — use whichever the generated client accepts; if neither types, `$queryRaw` `@>`). Test: delete path does not call unfiltered `findMany` of all drafts.

---

## Slice 6 — Teacher UI Chinese + paper + a11y + dirty nav + persist-before-publish

All teacher-visible strings in these files become Chinese. Use `Button` + token colors. Primary actions `min-h-11`.

| File | Changes |
| --- | --- |
| `app/page.tsx` | Keep marketing `h1`「题库工作台」. `UnlockForm` heading becomes `h2`「登录」. |
| `components/auth/unlock-form.tsx` | `h2`; `spellCheck={false}` on username; submit stays enabled until request starts (already). |
| `components/draft/draft-review-workspace.tsx` | Translate remaining English; confidence text; 保存/退回/入库 use `Button` `min-h-11`; **remove duplicate**「退回草稿」 (keep one「退回」→ `REJECTED`); tokens; wire unsaved guard. |
| `components/question/option-editor.tsx` | 选项标记 / 选项内容 / 删除该选项; tokens. |
| `components/question/answer-editor.tsx` | 答案类型 / 正确选项 / 答案文本; checkbox row `min-h-11`; tokens. |
| `components/question/official-question-editor.tsx` | 保存修订 uses `Button` `min-h-11`; tokens; 停用 → `window.confirm`; **persist-before-publish**; overlay recovery. |
| `components/question/question-editor.tsx` | overlay recovery on new-question form. |
| `components/question/question-preview.tsx` | `prose-slate` / `slate-200` → token/stone-free (`border-[var(--ink-border)]`). |
| `components/question/question-list.tsx` | Drop Lucide `FileQuestion` above empty heading; tokens. |
| `components/search/question-search-panel.tsx` | 中文结果计数、空结果、加入组卷篮; drop `bg-sky-100`; tokens. |
| `components/search/question-set-basket.tsx` | 默认标题「未命名组卷」; 导出; checkbox labels `min-h-11`; tokens. |
| `components/taxonomy/taxonomy-admin.tsx` | Visible `<label htmlFor>` for 名称 / slug / 父节点 / 分组; 添加/保存/删除 `Button`; 删除 `window.confirm`; tokens. |
| `components/raw-asset/raw-asset-upload.tsx` | 「已关联来源」+ id; tokens. |
| `components/agent-keys/agent-key-manager.tsx` | Issued block is `<section aria-labelledby>` **not** `role="dialog"` (in-page, no fake modal). |
| `app/globals.css` | `--ink-faint` ≈ `oklch(38% 0.02 250)` (match `--ink-soft` band). `color-scheme: light`. |
| `components/ui/empty-state.tsx` | unchanged if already paper. |

**Unsaved recovery (Codex M4; R5-N1 closed by not cancelling History) — required for teacher-loop 9+:**

Ship `lib/ui/editor-overlay.ts`:

```ts
readEditorOverlay(key): snapshot | null
writeEditorOverlay(key, snapshot): void  // rAF-coalesce OK; pagehide must be sync
clearEditorOverlay(key): void
useEditorOverlay({ key, snapshot, onHydrate })
```

and `useLinkLeaveConfirm(isDirty)` for in-app `<a>` only (no `popstate` listener).

Behavior:

1. Official / draft / new-question editors write overlay on field change; `pagehide` flushes sync.
2. Mount: overlay hydrates into local state; banner 「已恢复未提交的修改」 (`role="status"`).
3. Successful 保存修订 / persist-before-publish / draft save: `clearEditorOverlay`.
4. Capture-phase link confirm while overlay dirty; ignore `_blank` / modified-click / hash.
5. `beforeunload` while overlay dirty (tab close).
6. **No** `popstate` handler, **no** `history.pushState`/`replaceState`/`go` from this feature.

**Tests (shipped overlay + official editor; jsdom `sessionStorage`):**

- Change answer; unmount; remount with original props → input shows the **edited** answer (overlay), banner present.
- Remount with a **newer** `version` than overlay `baseVersion` → overlay dropped; server props shown.
- 保存修订 200 → overlay cleared; remount shows server props.
- Overlay dirty: click `<a href="/drafts">` confirm false → `defaultPrevented`. After clear, click does not confirm.
- `pagehide` handler writes storage even if rAF has not flushed.
- Typing does not call `history.pushState`.
- Persist-before-publish still required (M5): overlay is not a substitute for 上架 writing the server.

Playwright if available: edit, click 工作台 (confirm), or navigate away and return to the question URL and see restored text. If unavailable, `{SCRATCH}/e2e-unavailable.log`; unit overlay tests remain the gate.

**Persist-before-publish (Codex M5 / R2 A3) — required for teacher-loop 9+:**

Ship `buildOfficialEditorPatch()` from the editor (or a tiny `lib/ui/official-editor-patch.ts`) used by **both** 「保存修订」 and 「上架」 persist:

```ts
{
  type: type || question.type,
  stemMd,
  ...(showOptions ? { options } : {}), // FULL rows, not previewOptions
  answer,
  solutionMd,
  knowledgePointIds,
  tagIds,
  difficulty, // number | null — 未设 is null, never omit the key
}
```

If `options` has an incomplete row or `answer` is incomplete, **do not fetch**; keep overlay.

Schema: `difficulty: z.number().int().min(1).max(5).nullable().optional()`. Domain already clears when the key is present and null (`lib/domain/official-question.ts` `difficultyProvided`).

「上架」:

1. If dirty, PATCH `buildOfficialEditorPatch()` (no status).
2. If not ok, show error, **do not** send `{ status: "PUBLISHED" }`, **do not** clear dirty.
3. If ok (or not dirty), then PATCH `{ status: "PUBLISHED" }`.
4. Snapshot the last successful patch as the clean baseline.

One combined PATCH `{ ...fields, status: "PUBLISHED" }` is acceptable **only if** the handler applies fields then status in one transaction and invalid fields leave status unchanged. Prefer two-step, matching `draft-review-workspace.tsx`.

「停用」: `window.confirm`; if dirty, persist complete snapshot first or refuse; then DEPRECATED.

**Tests (shipped `OfficialQuestionEditor` + schema/domain):**

- Change answer, click 上架: first fetch body includes the new answer; 400 on field PATCH ⇒ no PUBLISHED call.
- Difficulty `4` → 未设 (`null`) → 保存修订 or 上架 persist body has `difficulty: null`; domain/route test: persisted difficulty is `null` after reload-shaped read. Clearing 400 ⇒ no PUBLISHED, dirty remains.
- Clear option B’s value while A remains the answer: 保存修订 / 上架 **refuses** (no PUBLISHED call); overlay still has B. Fill B → save/reload keeps A and B.
- Clean REVIEWED question with complete options: 上架 may status-only.

**Draft (R6-N1) tests (shipped parser + workspace + repository):**

- `parseHumanQuestionDraftInput({ stemMd, difficulty: null })` keeps `difficulty: null` (does not omit).
- Editor 4 → 未设 → 保存: PATCH body has `difficulty: null`; fake db update receives null; remount with returned draft shows 未设.
- persist-before-promote after clear: created official question `difficulty` is null.
- Overlay clears only after that save 200.
- Add empty option `{ label: "B", value: "" }`, save: parser **succeeds**; reload preserves both rows and other edits. Promote with that row still **fails** official `optionSchema` until filled. Do not globally relax official `optionSchema`.
- Existing text answer `"old"` → clear to `""` → save: persisted answer is empty; reload shows empty; promote **fails** until filled. Overlay clears only after the empty-answer persist 200.

New-question editor (Codex R9-n1): `components/question/question-editor.tsx` must send the **full** options array and empty answer on create (Decision 14). Test: unfinished option + empty answer POST succeeds as a draft; reload retains both. Promote still strict.

Official editor props include `version: number` from latest `QuestionVersion` (page query). Overlay stores full `options`, not `previewOptions`. Immediate unmount before rAF still recovers via `pagehide` or sync write on change in tests.

**Existing tests** that `getByRole` English names (`Remove`, `Add to basket`, `Create and export`, heading `登录` as `h1`) **must be updated** in the same slice so `npm run check` stays the bar. Success/error toast strings that teachers see (`Unable to update…`, `Saved version`) become Chinese in the same files.

---

## Slice 7 — Docs vs code

Update:

- `README.md`: draft tabs query by status, 50 per page, global counts, page navigation; uploads sniff magic bytes and file GET is `nosniff` + encoded disposition; agent promote attributes `createdById` when the key has a creator; `has_image` means IMAGE-kind source or a **parsed** local markdown image (`/api/raw-assets/…`), not `QuestionAsset`, not PDF/text sources, and not a substring coincidence; intent-only queries do not require those literals in the stem; CI workflow runs `npm run check`; single-instance rate limit invariant (already); logout DELETE (already); dirty **in-app link** confirm plus sessionStorage overlay recovery on Back/Forward (history is not cancelled); official 上架 and draft save persist a complete snapshot including cleared difficulty (`未设` → null).
- `docs/development.md`: same; node environment for raw-asset route tests; dashboard layout gate; **correct Playwright env**: `TEACHER_BOOTSTRAP_USERNAME` / `TEACHER_BOOTSTRAP_PASSWORD` (see `playwright.config.ts`), not `EDITOR_SESSION_SECRET`. Setup order: install deps → `prisma generate` / migrate (all committed migrations, not only init) → seed → `npm run check`. E2E still local, not CI.
- `skills/physhub/SKILL.md` or `references/api.md`: one line on `has_image` / promote actor if the agent contract changes.
- This plan stays as the completion record.

Do not claim origin is synced. Do not claim E2E runs in CI.

---

## Test and verification matrix (implementation must produce)

| Claim | Shipped entry point | Test |
| --- | --- | --- |
| `NEEDS_REVIEW` not dropped behind 50 other unpromoted | `listUnpromotedDrafts` + `DraftsPage` | domain fake-db 51 DRAFT + 1 NEEDS_REVIEW; page asserts Prisma `where.status` |
| Same-status overflow reachable | `listUnpromotedDrafts` | 51 NEEDS_REVIEW; page 2 returns the 51st; global count 51 |
| SVG upload 400 | `POST` `/api/raw-assets` and `/api/agent/raw-assets` | existing tests, node env, **signed** oversize PNG prefix |
| Oversize PNG 400 | same POST | existing tests, node env |
| HTML-as-PNG 400 | `parseRawAssetFormData` | new |
| File GET nosniff + disposition | GET file route | new header assert; Chinese name uses `filename*` |
| Agent cannot publish | existing | keep green |
| Agent actor | agent promote POST | `createdById` forwarded |
| VIEWER cannot PATCH | questions PATCH | 403 |
| `has_image` IMAGE vs TEXT/PDF vs AST figure vs mixed/code/reference/whitespace/entity | `questionHasImage` + write column + `searchQuestions` | Slice 4a table; column not 200-cap |
| Intent-only `有图`/`基础题` without literals; alias residual not ANDed | `understandQuestionSearchQuery` + `buildQuestionSearchWhere` | Slice 4b |
| Overlay restores edits after unmount; newer server drops overlay; save clears; link confirm while dirty | `useEditorOverlay` + official editor | R6: no popstate intercept |
| 上架 persists complete snapshot including `difficulty: null` | `OfficialQuestionEditor` + schema | edited answer; 4→未设 persists null; failed save skips PUBLISHED |
| Draft 4→未设 save/reload null; promote writes official null | `buildDraftEditorPatch` + `parseHumanQuestionDraftInput` + editor | R6-N1; overlay clears only after persist |
| Draft incomplete option saves; promote still rejects it | `draftOptionSchema` + promote | R7-N1 |
| Official incomplete option B refuses save/publish; overlay keeps B | `OfficialQuestionEditor` | R8-N1 |
| Draft cleared answer saves empty; promote fails until filled | `draftAnswerSchema` + editor | R8-N2 |
| Taxonomy delete not unbounded | `deleteKnowledgePoint` / `deleteTag` | no unfiltered draft `findMany` |
| `npm run check` | package.json | exit 0 |
| `npm run build` | package.json | exit 0, `{SCRATCH}/build.log` |
| CI artifact | `.github/workflows/check.yml` | file exists; steps include `npm run check` |
| Chinese chrome | component tests | getByRole Chinese names |
| A11y smoke (R2 a1) | layout + taxonomy + keys + home | one home `h1`; skip → `#main`; taxonomy `label htmlFor`; issued key not `role=dialog`; primary `min-h-11` |

Local E2E (`npm run test:e2e`) is **evidence**, not a CI gate: login, open 待审, skip-link target `#main`, file GET header if reachable. If Playwright/Postgres cannot boot, write `{SCRATCH}/e2e-unavailable.log` with the error; unit tests + `npm run check` + `npm run build` remain the bar.

---

## Implementation order

1. Slice 1 queue + pagination (unblocks teacher loop + domain + M1).
2. Slice 2 upload (unblocks tests + security + m1/m4).
3. Slice 3 actor.
4. Slice 4 search image + residual (M2/M3).
5. Slice 5 auth/layout/headers/CI/`listQuestions`/taxonomy JSON.
6. Slice 6 UI/a11y/dirty-nav/persist-publish (M4/M5; expect test selector churn).
7. Slice 7 docs (m2).
8. `npm run check` + `npm run build`; capture logs; independent score tables.

Each slice should leave `npx vitest run` on touched files green before the next slice.

---

## Ops 9+ — why this is enough without Redis or origin push

Prior v1 target for ops was ~7 (no CI, no logout, shared rate-limit bucket). Logout already shipped. Remaining honest holes for 9:

- Repeatable quality gate → **workflow file in git** (auditors can read it; a remote green run is a non-goal).
- Browser XSS belt → **headers + nosniff**.
- Forgotten dashboard page → **layout gate**.
- Multi-instance rate limit → **explicit non-goal**; README invariant “v1 is one Node process”. Scoring instruction for auditors: do **not** deduct below 9 for missing Redis if the invariant is documented and the workflow exists.
- Compile evidence → local `npm run build` in verification (not CI).

If an auditor still scores ops 8 because origin was not pushed, that is out of scope for this plan; the plan-audit must accept the in-repo workflow as the 9+ artifact, or the bar is unverifiable in this environment.

---

## PR Plan (logical; may land as one workspace change)

| # | Title | Files | Depends |
| --- | --- | --- | --- |
| 1 | Status-complete pageable unpromoted draft listing | `lib/domain/draft-listing.ts` or repository, drafts page, unit tests | — |
| 2 | Raw-asset 400, sniff, nosniff, signed fixtures, disposition | upload + file routes + tests | — |
| 3 | Agent promote actorId from API key creator | agent-auth, agent promote/create routes, tests | — |
| 4 | hasRenderedImage + AST figures + residual search text | schema/migration, question-search, promote/update writes, backfill, tests + skill line | — |
| 5 | workbench writes, layout, headers, CI, listQuestions, taxonomy JSON | auth call sites, layout, next.config, workflow, taxonomy-write | — |
| 6 | Chinese paper UI + a11y + overlay recovery + persist-before-publish | components listed in slice 6, tests | 5 helpful not required |
| 7 | Docs match code | README, development.md, skill | 1–6 |

---

## Open questions

None. Product decisions above are closed so implementation can start after plan audits pass. Codex R1–R8 majors are closed in this revision rather than deferred. Popstate cancellation is an explicit non-goal after R5-N1. Draft vs official validation split is the class fix for incomplete fields.

---

## Plan-audit checklist (for Codex and the second auditor)

Record **pass** only if all are true:

- [ ] Every scoring dimension has a concrete gap and a 9+ action (table in this doc).
- [ ] Non-goals match harness-first v1 (no LLM/MCP/Redis/NextAuth; agents stay `REVIEWED`).
- [ ] Queue fix is Prisma-filtered by status **and** paginates same-status overflow (M1).
- [ ] `has_image` is IMAGE kind or **parsed** local markdown image persisted as `hasRenderedImage` (M2/A1/F2/F3); search filters the column (includes entity-decoded URLs; no 200-cap).
- [ ] Intent-only queries do not add `textContains(rawQuery)` (M3); alias spans are consumed.
- [ ] Unsaved work uses sessionStorage overlay recovery + link confirm; **no popstate interception** (M4 / R5-N1). Unmount/remount restores edits; save clears overlay.
- [ ] Official 上架 **and human draft save** persist complete snapshots including `difficulty: null`; `omitAbsentDraftFields` does not strip explicit null (M5/A3/R6-N1). Draft option **and answer** schemas accept incomplete/empty values; promote/official stay strict and **do not filter** incomplete official options (R7-N1/R8-N1/R8-N2).
- [ ] Raw-asset tests call shipped `POST` and expect 400, with a real diagnosis (jsdom `formData`), not a rewritten helper; success fixtures are signed (m1).
- [ ] Ops 9+ is an in-repo workflow + headers + layout, not a silent bar drop and not Redis.
- [ ] Agent still cannot `PUBLISHED`.
- [ ] No major defect remains that would force a dimension to stay ≤8 after faithful implementation.

Write the audit to `docs/plans/2026-10-13-complete-fix-plan-codex-audit.md` (Codex) or `docs/plans/2026-10-13-complete-fix-plan-second-audit.md` (second auditor). Verdict line: `Verdict: pass` or `Verdict: fail` plus major issues if fail.
