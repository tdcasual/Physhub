# Physhub

Physhub is a small-team cloud workbench for **curating existing** high-school physics questions.

It is not an AI generator, not a chat app, and it does not call an LLM from the Next.js process. External coding-agent harnesses (Grok, Codex, Kimi, Claude Code, and similar) do OCR, structuring, and classification. Physhub stores raw assets and drafts and lets a human review drafts before they become official questions.

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

   Use those 64 hex characters. Do not use a password, birthday, or any other human-chosen string. Human APIs and dashboard pages fail closed without a valid editor session cookie (401). Open the site, enter this secret on the unlock form, then review and promote drafts.

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

Workbench navigation is **Questions** / **Drafts** / **New draft** / **Taxonomy**. Dashboard routes stay locked until the editor secret is accepted.

## Secrets

Physhub is designed around two authentication classes. They are not interchangeable.

| Variable | Who | Notes |
| --- | --- | --- |
| `EDITOR_SESSION_SECRET` | Human editor session | Generate with `openssl rand -hex 32`. Missing or invalid session fail-closes human APIs with `401` `Unauthorized`. Dashboard pages render the unlock form and do not load draft or question fields. |
| `AGENT_API_KEY_DEV` | Local agent tooling | **Non-production only.** Production ignores this variable and authenticates agents against hashed keys in the `ApiKey` table (`keyHash`, scopes, `revokedAt`). Create production keys with `npx tsx scripts/create-api-key.ts`. |

Do not paste an agent key into the teacher browser. Do not send the editor cookie to `/api/agent/*`. Agent `POST /api/questions` returns `403` `Agent cannot publish questions`.

## Agent skill

Harness instructions live at [`skills/physhub/SKILL.md`](skills/physhub/SKILL.md). The Next.js runtime does not load skill files; they are an operations manual for the harness, not a permission system.

## Drafts and official questions

- Agents and humans write **drafts**. Incomplete drafts are allowed.
- Draft knowledge points and tags are JSON arrays (`knowledgePointIds`, `tagIds`) on `QuestionDraft`, not join tables. Promote re-checks that those ids still exist.
- Official insert is human **promote** (`POST /api/drafts/:id/promote`). Human `POST /api/questions` is a create-draft + promote wrapper, not a second insert path. Agents cannot publish.
- Mock parse/classify HTTP routes are **rule fixtures**, not OCR. They require a human session and stay off unless `ENABLE_MOCK_PARSE=true` or `ENABLE_MOCK_CLASSIFY=true`. Production default is off. Mock classification suggestions omit `knowledge_points[].id` and cannot be accepted as confirmed metadata.

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
