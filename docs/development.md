# Development

This project is the cloud backend/workbench for a high-school physics question bank. The MVP is built around human-reviewed questions; AI support stays in draft, suggestion, classification, and search-help workflows.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

2. Start PostgreSQL and set `DATABASE_URL` in `.env`.

   The default local value is:

   ```sh
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public"
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

4. Apply the database migration:

   ```sh
   npm run db:migrate -- --name init
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

AI may:

- Create drafts from existing source material.
- Create suggestions for human review.
- Help classify existing questions.
- Help search or translate natural-language search intent into structured filters.

AI must not:

- Publish final questions.
- Delete final questions.
- Generate original questions.
- Directly overwrite confirmed metadata.

Agent APIs should stay conservative. They may support retrieval, classification suggestions, and draft workflows, but final question publication, destructive actions, and confirmed metadata changes require human-controlled paths.
