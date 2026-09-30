# Physhub

Physhub is a small-team cloud workbench for **curating existing** high-school physics questions.

It is not an AI generator, not a chat app, and it does not call an LLM from the Next.js process. External coding-agent harnesses (Grok, Codex, Kimi, Claude Code, and similar) do OCR, structuring, and classification. Physhub stores raw assets and drafts. Humans or agents can promote a complete draft into an official `REVIEWED` question; only a human can mark it `PUBLISHED`.

v1 does not include an MCP server or an in-process model.

## Setup

1. Copy the example environment file:

   ```sh
   cp .env.example .env
   ```

2. Set the first teacher login in `.env` (used by seed):

   ```
   TEACHER_BOOTSTRAP_USERNAME="owner"
   TEACHER_BOOTSTRAP_PASSWORD="choose-a-long-password"
   ```

   Then `npm run db:seed`. Open the site and log in with that username and password. Add more teachers with `npx tsx scripts/create-teacher.ts --username zhangsan --password …`. There is no public registration.

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

Workbench navigation is **工作台** / **题库** / **录入** / **知识点**. Dashboard routes stay locked until a teacher logs in.

## Secrets

Physhub is designed around two authentication classes. They are not interchangeable.

| Variable | Who | Notes |
| --- | --- | --- |
| `TEACHER_BOOTSTRAP_USERNAME` / `TEACHER_BOOTSTRAP_PASSWORD` | First teacher | Seed hashes the password onto the OWNER user. Missing password means nobody can log in until you run `create-teacher.ts`. Logout is **锁定** (`DELETE /api/auth/login`). |
| `AGENT_API_KEY_DEV` | Local agent tooling | **Non-production only.** Production ignores this variable and authenticates agents against hashed keys in the `ApiKey` table (`keyHash`, scopes, `revokedAt`). Teachers copy and issue keys on **密钥**. CLI remains `npx tsx scripts/create-api-key.ts`. |
| `AGENT_KEY_WRAP_SECRET` | Wrap stored agent keys | 32-byte hex. Encrypts plaintext so teachers can copy an existing key. Auth still uses `keyHash`. Missing wrap secret: keys still authenticate, but the page cannot issue or reveal. |
| `TRUST_PROXY` | Reverse proxy | Unset by default. v1 is a **single instance**: unlock rate limiting then counts every client in one `"local"` bucket. Set `TRUST_PROXY=true` only behind a trusted reverse proxy. |

Do not paste an agent key into the teacher browser. Do not send the editor cookie to `/api/agent/*`. Agent keys ingest through `/api/agent/questions` and `/api/agent/question-drafts/:id/promote` (`REVIEWED` only). The same key on human `POST /api/questions` still returns `403` `Agent cannot publish questions`.

## Agent skill

Harness instructions live at [`skills/physhub/SKILL.md`](skills/physhub/SKILL.md). The Next.js runtime does not load skill files; they are an operations manual for the harness, not a permission system.

## Drafts and official questions

- Agents and humans write **drafts**. Incomplete drafts are allowed.
- Draft knowledge points and tags are JSON arrays (`knowledgePointIds`, `tagIds`) on `QuestionDraft`, not join tables. Promote re-checks that those ids still exist.
- Official insert is always **promote**. Humans: `POST /api/drafts/:id/promote` or `POST /api/questions` (create-draft + promote). Agents: `POST /api/agent/question-drafts/:id/promote` or `POST /api/agent/questions`. Both land at `REVIEWED`. Agents cannot set `PUBLISHED` and cannot use the human publish URLs.
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
