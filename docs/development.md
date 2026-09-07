# Development

This project is the cloud workbench for curating **existing** high-school physics questions. See the root [README](../README.md) for product setup, secrets, and the harness-first boundary.

The platform does not embed an LLM and does not ship an MCP server. External coding-agent harnesses structure source material; humans review drafts before they become official questions. Promote is the only official insert path.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

   Generate `EDITOR_SESSION_SECRET` with a CSPRNG (`openssl rand -hex 32`) and add it to `.env`. A missing secret fail-closes human APIs with 401. `AGENT_API_KEY_DEV` is non-production only; production is designed to use the `ApiKey` table.

2. Start PostgreSQL and set `DATABASE_URL` in `.env`.

   The default local value is:

   ```sh
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public"
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Apply the committed `init_harness_first` migration:

   ```sh
   npm run db:migrate
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

Open `/questions` and enter the editor secret. Dashboard pages do not query drafts or questions until that cookie is set.

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

The E2E command builds the app and starts the production server on port 3100. Playwright injects a test `EDITOR_SESSION_SECRET` via `webServer.env`; it does not rely on a developer `.env`.

## AI Boundary

The platform does not embed an LLM or OCR. The default product path is an external coding-agent harness submitting already-structured drafts through `/api/agent/*`. Human review and promote are the only way a draft becomes a formal `Question`.

`POST /api/raw-assets/:id/parse` and `POST /api/questions/:id/classify` are rule-based test fixtures, not product AI. They require a human session and stay off unless `ENABLE_MOCK_PARSE=true` or `ENABLE_MOCK_CLASSIFY=true`. Production default is off. Mock classify payloads have no `knowledge_points[].id` and cannot be accepted.

Harness / AI may:

- Create drafts from existing source material.
- Create suggestions for human review.
- Help search or translate natural-language search intent into structured filters.

Agents must not:

- Publish final questions. Official insert is human promote (`POST /api/drafts/:id/promote`). Human `POST /api/questions` is a create-draft + promote wrapper. Agent `POST /api/questions` returns `403` `Agent cannot publish questions`.
- Delete final questions.
- Generate original questions.
- Directly overwrite confirmed metadata.

Agent APIs stay conservative: retrieval, drafts, suggestions, quality-check, sets, and export. Final publication, destructive actions, and confirmed metadata changes require human-controlled paths.

Draft knowledge points and tags are JSON arrays on `QuestionDraft`, not join tables. Harness instructions live at `skills/physhub/SKILL.md`; the runtime does not load them.

Mutating agent writes store `IdempotencyRecord` rows. v1 has no cleaner; keep them about 90 days, then delete by hand.
