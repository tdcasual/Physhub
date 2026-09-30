# Independent Kimi audit task

You are Kimi Code CLI, an independent auditor. Do NOT trust any Grok scores, previous chat, or docs/plans claims unless you verify them in the repo at HEAD.

Workspace: /home/tdcasual/codework/Physhub
HEAD: git rev-parse HEAD (expect 13b4c60)

## Rules
- Read-only except writing ONE file: docs/plans/2026-09-08-project-score-kimi.md
- Fact-check with git, grep, read_file, and optionally `npm test` if cheap. Do not invent test counts.
- For each score, cite a path or command result.
- Scale 0–10 integers. 10 = done for the **stated v1 boundary** (harness-first workbench: no in-process LLM, no MCP, no Meilisearch). Do NOT penalize missing Phase C items.
- Be skeptical of “shipped” language in docs.

## Score these dimensions (required table)

| Dimension | Score 0-10 | Evidence (file:line or command) |
| Product completeness vs harness-first v1 | | |
| Teacher closed loop (unlock → named KP → promote → list) | | |
| Agent/harness path & AI boundary (agent cannot publish) | | |
| Auth / session / secrets | | |
| Domain correctness (draft JSON KP, promote validation, versions) | | |
| Tests (unit + e2e coverage vs claims) | | |
| Docs vs code | | |
| Teacher UI usefulness (no cuid, taxonomy tree, basket) | | |
| Accessibility / touch / i18n | | |
| Production / ops readiness (origin sync, rate limit, logout, TRUST_PROXY) | | |
| Code quality / maintainability | | |
| Overall (weighted toward teacher loop + security + verification) | | |

## Also include
1. Executive verdict: Pass / Conditional Pass / Fail
2. Fact-check table for these claims:
   - Local master is 13b4c60, origin/master is behind by 1 commit
   - TaxonomyFields exists and is used by new draft, draft review, official editor
   - Promote disabled without KP; API still 400 必须确认知识点
   - Playwright e2e includes promote.spec.ts; bundled Chromium unsupported on Ubuntu 26.04
   - Search can add to basket; export publishedOnly default false, true → 400
   - Taxonomy parent cycle → 409
   - npm test was 49 files / 390 passed (re-run if you can; if you cannot, say unverified)
   - No logout; cookie is HMAC of shared EDITOR_SESSION_SECRET
   - getConnectingIp returns "local" without TRUST_PROXY
   - html lang=en
3. Doubts (unknowns you could not close from the repo)
4. Issues: severity major/minor/nit, file, description, suggestion, status open
5. Where you disagree with a naive “Phase D fully shipped to GitHub” story

Write the report in Chinese, same shape as docs/plans/2026-09-07-after-v1-kimi-audit.md (metadata table, executive summary, fact-check, doubts, issues).
