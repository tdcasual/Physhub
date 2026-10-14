# Development

This project is the cloud workbench for curating **existing** high-school physics questions. See the root [README](../README.md) for product setup, secrets, and the harness-first boundary.

The platform does not embed an LLM and does not ship an MCP server. External coding-agent harnesses structure source material. Promote is the only official insert path: humans use `/api/drafts/:id/promote` or `/api/questions`; agents use `/api/agent/question-drafts/:id/promote` or `/api/agent/questions`. Both create `REVIEWED` questions. Only a human can mark a question `PUBLISHED`.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

   Set `TEACHER_BOOTSTRAP_USERNAME` and `TEACHER_BOOTSTRAP_PASSWORD` in `.env`, then seed. Teachers log in with that account. `AGENT_API_KEY_DEV` is non-production only; production agents use hashed keys in the `ApiKey` table. Set `AGENT_KEY_WRAP_SECRET` (32-byte hex) so the **密钥** page can issue and copy keys. Teachers manage keys in the workbench; `npx tsx scripts/create-api-key.ts` still works.

2. Start PostgreSQL and set `DATABASE_URL` in `.env`.

   The default local value is:

   ```sh
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public"
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Generate the Prisma client and apply **all committed migrations** (not only `init_harness_first`), including `hasRenderedImage`:

   ```sh
   npx prisma generate
   npm run db:migrate
   ```

   After migrate, backfill existing official questions once:

   ```sh
   npx tsx scripts/backfill-has-rendered-image.ts
   ```

5. Seed development data:

   ```sh
   npm run db:seed
   ```

   Known local caveat: `db:seed` requires a reachable PostgreSQL database through `DATABASE_URL`.

6. Start the development server:

   ```sh
   npm run dev
   ```

Open `/questions` and log in with a teacher account. `(dashboard)/layout.tsx` gates the whole workbench: missing session renders 登录 and does not load children. Pages still check the cookie so unit tests can render without Prisma. After unlocking, **锁定** in the nav (or `DELETE /api/auth/login`) clears the session cookie. Agent keys are on **密钥** (`/agent-keys`).

Raw-asset POST route tests run in the Vitest **node** environment (`// @vitest-environment node`) so `Request.formData()` works. Success fixtures use real PNG/PDF magic bytes.

Non-production only: human APIs also accept `X-Physhub-Editor-Session` with the same HMAC hex as the cookie. Production ignores that header.

## Quality Commands

Run the main local quality gate before handing off changes:

```sh
npm run check
```

`npm run check` runs lint, TypeScript validation, and unit tests. It intentionally does not run the slower production-server E2E flow.

Run TypeScript by itself while iterating on types:

```sh
npm run typecheck
```

Run E2E tests when changing user flows, routing, production startup, or browser behavior:

```sh
npm run test:e2e
```

The E2E command builds the app and starts the production server on port 3100. Playwright sets `TEACHER_BOOTSTRAP_USERNAME` / `TEACHER_BOOTSTRAP_PASSWORD` on `webServer.env` (see `playwright.config.ts`). It does not inject `EDITOR_SESSION_SECRET`. A developer `.env` is still used for `DATABASE_URL`. CI does **not** run E2E; `.github/workflows/check.yml` runs `npm run check` only.

E2E prerequisites (the suite does not skip when they are missing):

1. Browser: `npm run test:e2e:install`. If Playwright 1.60 cannot find `chromium_headless_shell-1223`, install Google Chrome and run with `PLAYWRIGHT_CHROME_CHANNEL=chrome`.
2. A reachable Postgres `DATABASE_URL` (Playwright forwards the process environment). Local docker: `docker start physhub-pg`.
3. Applied migration and seed: `npx prisma migrate deploy` then `npm run db:seed`

Unlock-only specs still hit Prisma after a successful cookie (dashboard pages list drafts/taxonomy). Promote specs also create drafts. Do not run `npm run test:e2e` against an empty or unreachable database. The command does not migrate for you.

## AI Boundary

The platform does not embed an LLM or OCR. The default product path is an external coding-agent harness submitting already-structured drafts through `/api/agent/*`. Official insert is promote (human or agent). Agent promote writes `REVIEWED` only.

`POST /api/raw-assets/:id/parse` and `POST /api/questions/:id/classify` are rule-based test fixtures, not product AI. They require a human session and stay off unless `ENABLE_MOCK_PARSE=true` or `ENABLE_MOCK_CLASSIFY=true`. Production default is off. Mock classify payloads have no `knowledge_points[].id` and cannot be accepted.

Harness / AI may:

- Create drafts from existing source material.
- Create suggestions for human review.
- Help search or translate natural-language search intent into structured filters.

Agents must not:

- Call human publish URLs. Agent `POST /api/questions` and `POST /api/drafts/:id/promote` return `403` `Agent cannot publish questions`. Use `/api/agent/questions` or `/api/agent/question-drafts/:id/promote` instead (`REVIEWED` only).
- Mark official questions `PUBLISHED` or `DEPRECATED`.
- Delete final questions.
- Generate original questions.
- Directly overwrite confirmed metadata.

Agent APIs: retrieval, drafts, official ingest at `REVIEWED`, suggestions, quality-check, sets, and export. Changing official status, destructive actions, and confirmed metadata changes still require human-controlled paths.

Draft knowledge points and tags are JSON arrays on `QuestionDraft`, not join tables. Harness instructions live at `skills/physhub/SKILL.md`; the runtime does not load them.

Mutating agent writes store `IdempotencyRecord` rows. v1 has no cleaner; keep them about 90 days, then delete by hand.
