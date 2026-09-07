# Physhub

Physhub is a small-team cloud workbench for **curating existing** high-school physics questions.

It is not an AI generator, not a chat app, and it does not call an LLM from the Next.js process. External coding-agent harnesses (Grok, Codex, Kimi, Claude Code, and similar) do OCR, structuring, and classification. Physhub stores raw assets and drafts, enforces schema and authorization, and lets a human review drafts before they become official questions.

v1 does not include an MCP server or an in-process model.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

2. Generate `EDITOR_SESSION_SECRET` with a CSPRNG and put the value in `.env`:

   ```sh
   openssl rand -hex 32
   ```

   Use those 64 hex characters. Do not use a password, birthday, or any other human-chosen string. If this secret is missing, human editor APIs fail closed (401).

3. Start PostgreSQL and set `DATABASE_URL` in `.env`. The default local value is:

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public"
   ```

4. Install dependencies:

   ```sh
   npm install
   ```

5. Apply the committed `init_harness_first` migration and seed:

   ```sh
   npm run db:migrate
   npm run db:seed
   ```

6. Start the development server:

   ```sh
   npm run dev
   ```

Workbench navigation is **Questions** / **Drafts** / **New draft**.

## Secrets

Physhub has two authentication classes. They are not interchangeable.

| Variable | Who | Notes |
| --- | --- | --- |
| `EDITOR_SESSION_SECRET` | Human editor session | Required. Generate with `openssl rand -hex 32`. Missing → fail closed. |
| `AGENT_API_KEY_DEV` | Local agent tooling | **Non-production only.** Production ignores this variable and authenticates agents against hashed keys in the `ApiKey` table (`keyHash`, scopes, `revokedAt`). |

Do not paste an agent key into the teacher browser. Do not send the editor cookie to `/api/agent/*`.

## Agent skill

Harness instructions live at [`skills/physhub/SKILL.md`](skills/physhub/SKILL.md). That package lands in a later PR, after the Agent Tool API exists. The Next.js runtime does not load skill files; they are an operations manual for the harness, not a permission system.

## Drafts and official questions

- Agents and humans write **drafts**. Incomplete drafts are allowed.
- Draft knowledge points and tags are JSON arrays (`knowledgePointIds`, `tagIds`) on `QuestionDraft`, not join tables. Promote re-checks that those ids still exist.
- A human **promote** inserts the official `Question` row. Human `POST /api/questions` is a convenience wrapper around create-draft + promote, not a second insert path. Agents cannot publish.
- Optional mock parse/classify HTTP routes may remain as **rule fixtures**, not OCR. They require a human session and `ENABLE_MOCK_PARSE` / `ENABLE_MOCK_CLASSIFY` (default off). Mock classification suggestions omit `knowledge_points[].id` and cannot be accepted as confirmed metadata.

## Idempotency records

Mutating agent writes store an `IdempotencyRecord`. v1 does not ship a cleaner. Keep rows for about 90 days, then delete them by hand if needed:

```sql
DELETE FROM "IdempotencyRecord" WHERE "createdAt" < now() - interval '90 days';
```

## Quality

```sh
npm run check
```

That runs lint, TypeScript, and unit tests. Playwright E2E is separate (`npm run test:e2e`).

See [docs/development.md](docs/development.md) for the quality-gate details.
