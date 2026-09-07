# Development

This project is the cloud workbench for curating **existing** high-school physics questions. See the root [README](../README.md) for product setup, secrets, and the harness-first boundary.

The platform does not embed an LLM and does not ship an MCP server. External coding-agent harnesses structure source material; humans review drafts before they become official questions. Promote is upcoming.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

   Generate `EDITOR_SESSION_SECRET` with a CSPRNG (`openssl rand -hex 32`) and add it to `.env` now. After editor-session auth, a missing secret fail-closes human APIs; this branch does not yet reject unauthenticated human requests. `AGENT_API_KEY_DEV` is non-production only; production is designed to use the `ApiKey` table.

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

The E2E command builds the app and starts the production server on port 3100.

## AI Boundary

The Next.js process does not call an LLM. Mock parse/classify HTTP routes are rule fixtures, not OCR. The design is to require a human session and `ENABLE_MOCK_PARSE` / `ENABLE_MOCK_CLASSIFY` (default off); today those routes still run unauthenticated.

External agents may:

- Create drafts from existing source material.
- Create suggestions for human review.
- Help classify existing questions (as suggestions; mock payloads omit knowledge-point ids and cannot be accepted).
- Help search or translate natural-language search intent into structured filters.

Agents must not:

- Publish final questions. The designed insert path is human promote, with human `POST /api/questions` becoming a create-draft + promote wrapper. Today that POST still writes `REVIEWED` directly.
- Delete final questions.
- Generate original questions.
- Directly overwrite confirmed metadata.

Draft knowledge points and tags are JSON arrays on `QuestionDraft`, not join tables. Harness instructions live at `skills/physhub/SKILL.md` in a later PR; the runtime does not load them.

Mutating agent writes will store `IdempotencyRecord` rows (table exists; write path lands with the agent tools). v1 has no cleaner; keep them about 90 days, then delete by hand.
