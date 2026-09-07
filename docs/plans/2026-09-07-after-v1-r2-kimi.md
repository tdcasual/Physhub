# Kimi Audit R2: After-v1 Next Plan

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI |
| Date | 2026-09-07 |
| Document | docs/plans/2026-09-07-after-v1-next-plan.md |
| Branch checked | execute-plan/2151bf2e-pr-8-demote-mock-workers-to-test-fixtures |
| Verdict | Approve |

## Executive Summary

R1 十条全部 fixed。本版方案对 A4 选定了唯一的锁读机制（page 级门卫：无 cookie 在 prisma 之前 return `<UnlockForm />`），明确否决「layout 省略 children」并把 middleware 降级为可选、v1 不要求，不存在两种互斥锁读机制并存。A6 把 400 / 422 / 401 / 403 拆成四个独立用例，每个用例单一状态码，且与 `lib/domain/promote-draft.ts`、`lib/auth/human-auth.ts` 的实际映射一致；不存在「同一请求两种 HTTP status / 两种 DB 写入」。本轮新写的「当前真实缺口」与 A4 机制描述经源码逐条核对，无编造。通过标准全部满足，Verdict: Approve。

## R1 issue status

| # | R1 项 | 判定 | 方案位置 |
| --- | --- | --- | --- |
| 1 | A1 不得早于 A4；合栈是最后一步 | fixed | Phase A 顺序约束「A4 →（A2/A3/A5 可并行）→ A6 → A1。禁止 A1 早于 A4」；A1 节标题「合栈（最后一步）」；PR 表 A1 依赖 A2 A3 A4 A5 A6 |
| 2 | A4 锁读：无 cookie 不得序列化 answerJson 等，不只藏 Promote | fixed | R1 已吸收表第 2 行；A4「无效：立刻 return <UnlockForm />，其后不得调用 prisma，也不得把 draft/question 字段传给 client component」 |
| 3 | A4 不得把「layout 省略 children」当锁读 | fixed | A4「不要把 layout 不渲染 {children} 当成锁读手段…选定：page 级门卫」（引用 vercel/next.js#88472） |
| 4 | A6：无知识点 400；id 不存在 422 | fixed | A6 E2E 表两行分开：「promote 未选知识点 → 400 必须确认知识点」「promote 知识点 id 不存在 → 422 Knowledge point not found」；R1 已吸收表第 3 行「不是把 400 改成 422」 |
| 5 | A3 全文 sweep | fixed | A3「不要只替换三句。对 README 与 docs/development.md 按关键词扫完：not yet / Today / lands / upcoming / still unauthenticated / this branch」 |
| 6 | B3 先补 KP/tag 写 API（现状只有 GET） | fixed | B3「先补 human 写 API，再做 UI。现状只有 GET」；源码确认 `app/api/knowledge-points/route.ts`、`app/api/tags/route.ts` 仅 `export async function GET` |
| 7 | B4 上传 API 已在，只补 UI | fixed | B4「不新做上传服务。POST /api/raw-assets 与 GET /api/raw-assets/:id/file 已鉴权」；源码确认 POST 存在且走 `requireHumanApiAuth`（route.ts:14） |
| 8 | B1 QuestionVersion 已有，PATCH 是 n+1 | fixed | B1「表已在；promote 已写 version: 1。本 PR 不新建表」；源码确认 `promote-draft.ts:415-418` 事务内 `questionVersion.create({ version: 1 })` |
| 9 | NQ-1b 否决；NQ-2 关闭为 agent 默认 REVIEWED+PUBLISHED | fixed | Open Questions NQ-1「NQ-1b（否决）」；NQ-2「已关」，B5 表把 agent 默认改为 `REVIEWED+PUBLISHED` 并点名改 `lib/search/question-search.ts` 与 `skills/physhub/SKILL.md`（源码现状确为只有 REVIEWED：question-search.ts:260，SKILL.md:57） |
| 10 | A6：401 vs 403 分开；Playwright 注入测试 secret | fixed | A6 E2E 表：agent Bearer POST /api/questions → 403 Agent cannot publish questions；无 cookie POST /api/drafts → 401 Unauthorized；「webServer.env 显式注入测试用 EDITOR_SESSION_SECRET」 |

## Fact-check vs repo（只核本轮新写或有疑点的句子）

| 方案句子 | 结论 | 证据 |
| --- | --- | --- |
| 「现有 dashboard page 在函数里直接 prisma」 | confirmed | `app/(dashboard)/questions/page.tsx`、`drafts/page.tsx`、`drafts/[id]/page.tsx` 均在模块函数内 `prisma.question.findMany` / `questionDraft.findUnique`，无 session 检查 |
| 「`/drafts/[id]` 把 answerJson / solutionMd / sourceRawAsset.textContent 序列化进客户端」 | confirmed | `drafts/[id]/page.tsx` 的 `draftSelect` 含 `answerJson`、`solutionMd`、`aiOutput`、`sourceRawAsset.textContent`，整 DTO 传给 client component |
| 「四个 dashboard page」覆盖 /questions、/drafts、/drafts/[id]、/questions/new | confirmed | `app/(dashboard)/` 下仅有 `drafts`、`questions` 两棵子树，共四个 page；`/questions/new` 不查库但挂编辑器，纳入门禁合理 |
| 「仓库目前也没有 middleware.ts」 | confirmed | 仓库根与 `src/` 均无 `middleware.ts` |
| 「app/(dashboard)/ 无 layout」 | confirmed | `ls app/(dashboard)` 只有 `drafts`、`questions` |
| 「lib/auth/human-auth.ts 用 node:crypto 且会动态 import prisma，不能整文件丢进 Edge middleware」 | confirmed | human-auth.ts:1 `import { createHmac } from "node:crypto"`；:66 `await import("@/lib/db/prisma")`；HMAC 公式 `physhub_editor.v1` + timingSafeEqual 与 A4 描述一致 |
| A6「400 必须确认知识点」与「422 Knowledge point not found」 | confirmed | `question-schema.ts:128` addError("必须确认知识点") → QuestionValidationError → 400；`promote-draft.ts:174` QuestionRelationError → mapPromoteApiError → 422（523–527） |
| 「401 vs 403 分开」 | confirmed | human-auth.ts:204-208 agent 打 publishRoute → 403 "Agent cannot publish questions"；:218 无凭证人 → 401 "Unauthorized" |
| 「Playwright 只有 smoke.spec.ts、不注入 secret」 | confirmed | `tests/e2e/` 仅 smoke.spec.ts；`playwright.config.ts` 的 webServer 无 `env` 字段 |
| 「没有 scripts/create-api-key.ts（仓库现在没有 scripts/）」 | confirmed | 仓库根无 `scripts/` 目录 |
| 「agent 省略 status 时默认只有 REVIEWED」 | confirmed | `lib/search/question-search.ts:260` `normalized.status = ["REVIEWED"]`；SKILL.md:57 同 |
| 「教师搜索面板显式 status: ["PUBLISHED","REVIEWED"]」 | confirmed | `components/search/question-search-panel.tsx:50` |
| 「相对 master 17 commit、origin/master = d59047f」 | confirmed | `git log master..HEAD` = 17；`git rev-parse origin/master` = d59047f |

## Doubts

None.

## Issues

None.

## Phase / PR Plan review

- **顺序约束自洽**：A4 →（A2/A3/A5 并行）→ A6 → A1，且 A6 依赖 A4（E2E 走解锁页）与 PR 表依赖一致；A1 是唯一碰 master 的 PR，NQ-1a 快进不丢按层审查能力（9 个分支已在 origin）。
- **A4 机制唯一**：选定 page 级门卫；layout 只做解锁后的壳、middleware 显式「可选、v1 不要求」。不存在两种互斥锁读机制。
- **状态码无冲突**：A6 四个用例（错误 secret 401/429、无 KP 400、KP id 不存在 422、agent 发布 403、无 cookie 写 401）各自单一状态码，且与 `mapPromoteApiError` 和 `requireHumanApiAuth` 的实际映射一一对应。
- **B 层与 v1 边界一致**：B1 原地 PATCH + 已有 QuestionVersion n+1 不新建表；B3 写 API 仅 human、agent 仍只读；B5 关闭 NQ-2 时同步改 agent 默认搜索，避免 publish 后 harness 丢题，且未削弱「agent 不能 promote」。
- **C 层触发条件可证伪**，Meilisearch/MCP 归 C 而非 v1 欠债，符合审计前提。

KIMI_NEXT_PLAN_R2 0 0 Approve
