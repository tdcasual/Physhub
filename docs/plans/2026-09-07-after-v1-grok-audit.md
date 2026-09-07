# Grok Audit: After-v1 Next Plan（对照 Kimi）

| 字段 | 值 |
| --- | --- |
| Auditor | Grok |
| Date | 2026-09-07 |
| Document | docs/plans/2026-09-07-after-v1-next-plan.md |
| Kimi report | docs/plans/2026-09-07-after-v1-kimi-audit.md |
| Branch checked | execute-plan/2151bf2e-pr-8-demote-mock-workers-to-test-fixtures |
| Verdict | Approve with issues（与 Kimi 同结论；Doubts 已用源码闭合） |

## Executive Summary

Kimi 对缺口表 11 行的事实核对全部成立。我独立读了同一批路径，没有发现编造缺口。Phase A→B→C 分层、NQ-1a 快进合栈、不内嵌模型、OQ-6 原地版本化，我都同意。

Kimi 提出 2 条 Doubts。源码可以回答，不再是未知：

1. 仓库里**没有**真实 Postgres + 浏览器 promote 验收的证据；现有 Playwright 甚至不碰数据库。
2. 无 cookie 时 dashboard **会**把题干、草稿答案、解析、原图文本渲给访客。A4 必须显式锁读，不能只藏 Promote 按钮。

Kimi Issue 1（A1 早于 A4）采纳为 major。Issue 2（缺知识点 400 vs 422）部分成立：空知识点是 400，id 不存在才是 422。Issue 3（README sweep）采纳，并补 `docs/development.md` 的「Promote is upcoming」。

## Doubts — 源码结论

### Doubt 1: 「未在真实 Postgres + 浏览器上验收」是否属实？

**结论：仓库内属实；无法排除仓库外手工点过。**

| 检查 | 结果 |
| --- | --- |
| `tests/e2e/` | 只有 `smoke.spec.ts` |
| smoke 路径 | `GET /` → 点 New draft → `/questions/new` 看 KaTeX |
| `/` 与 `/questions/new` | 不查 Prisma（home 静态；new 只挂 `QuestionEditor`） |
| `playwright.config.ts` | `npm run build && next start -p 3100`，不注入 `EDITOR_SESSION_SECRET`，不跑 migrate/seed |
| 栈未进 `master` | `origin/master` = `d59047f`，落后栈顶 17 commit |

因此：自动化验收**没有**覆盖解锁、保存、promote，也**不需要** Postgres 就能绿。方案把「没有真实验收」列为缺口是对的。若作者在本机手工走过，仓库无法证明，也不可复现。

### Doubt 2: 无 cookie 时 server components 会不会把题目内容读出来？

**结论：会。而且比「能看列表不能写」更严重：草稿详情把答案也序列化进 RSC。**

无 `physhub_editor` cookie 时：

| 路由 | 行为 | 泄露 |
| --- | --- | --- |
| `/questions` | `prisma.question.findMany`，无 session | `publicId`、`stemMd`、status、difficulty、知识点名、标签 |
| `/drafts` | `prisma.questionDraft.findMany`，无 session | 未 promote 草稿题干前 120 字 |
| `/drafts/[id]` | `prisma.questionDraft.findUnique` 后把完整 DTO 传给 client | **`stemMd`、`optionsJson`、`answerJson`、`solutionMd`、`aiOutput`、suggestions、agentRuns、`sourceRawAsset.textContent`** |
| `/questions/new` | 无 DB | 不泄露存量数据；Save 打 `POST /api/drafts` → 401 |
| 搜索面板 | `fetch /api/search/questions` | 401（API 已锁） |
| `GET /api/raw-assets/:id/file` | `requireHumanApiAuth` | 401（图锁了；但草稿页已经把 `textContent` 放进 HTML） |

`app/(dashboard)/` **没有** `layout.tsx`。根 `app/layout.tsx` 只渲染 `Nav` + children，不读 cookie。

方案 A4 原文是「无 cookie 时 dashboard 渲染解锁表单，**不暴露 Promote**」。按字面可以做成：页面照旧查出答案，只是藏 Promote、旁边放解锁表单。那读侧漏洞还在。

**A4 必须写死：** 无有效 cookie 时 dashboard 路由不得查询 Prisma、不得把 draft/question 字段序列化到客户端；只渲染解锁表单。`/questions/new` 同样先解锁再给编辑器。

## Kimi Issues — 裁定

### Issue 1（major）— 采纳，并加强

A1 快进 master 之后、A4 之前：写按钮全 401，且没有任何 UI 能换 cookie。同时 RSC 读仍然公开（见 Doubt 2）。当前 `master` 是无认证 MVP，合栈会把「能写」变成「能看答案但不能写」，对老师更差。

推荐 Kimi 的 (b)：**A1 与 A4 合成一个发布动作**（栈顶先落解锁页再快进，或合栈 PR 同时带解锁页）。不要把 A4 留在两个 docs PR 之后。

### Issue 2（minor）— 部分采纳，不要把 400 改成 422

「缺知识点」在实现里是两条路径：

1. 草稿没有知识点 / 空数组 → `validatePublishableQuestion` 报「必须确认知识点」→ `QuestionValidationError` → **400**（`lib/domain/promote-draft.ts` 143–147，`lib/domain/question-schema.ts` 127–128）。
2. `knowledgePointIds` 里有库中不存在的 id → `assertKnowledgePointsExist` → `QuestionRelationError("Knowledge point not found")` → **422**（同文件 173–174、523–527）。

老师在校对台漏选知识点，走的是 1，方案写 400 **对**。Kimi 看到的是 2。

A6 应写成两句，而不是改成单一 422：

- promote 无知识点 → 400 `必须确认知识点`
- promote 知识点 id 不存在 → 422 `Knowledge point not found`

### Issue 3（nit）— 采纳，并补 development.md

README 过期句比方案点名的多。`docs/development.md` 另有：

- 第 5 行：「Promote is upcoming.」（栈顶 promote 已落地）
- 第 15 行：仍写未鉴权 human API

A3 全文 sweep `not yet` / `Today` / `lands` / `upcoming` / `still unauthenticated`。

## Grok 额外事实（Kimi 未单列、实现时会踩）

1. **B3 不只是 UI。** `app/api/knowledge-points/route.ts` 与 `app/api/tags/route.ts` **只有 GET**。树的增删改需要新的 human POST/PATCH/DELETE，禁删仍被引用的节点 → 409。Agent 继续只能 list。
2. **B4 上传 API 已在。** `POST /api/raw-assets` 已鉴权且收 multipart；草稿 schema 已有 `sourceRawAssetId`。缺的是编辑器/校对台的文件选择，不是新上传服务。
3. **B1 的 `QuestionVersion` 表已在用。** `promoteInTransaction` 已 `questionVersion.create` `version: 1`。PATCH 是 n+1，不是新建表。
4. **NQ-2 与代码已经分叉。** 列表页默认 `REVIEWED+PUBLISHED`；搜索面板显式 `constraints.status: ["PUBLISHED","REVIEWED"]`；agent 搜索省略 status 时默认 **只有 `REVIEWED`**（`lib/search/question-search.ts` 260，skill 第 57 行）。B5 若把题改成 `PUBLISHED` 且不改 agent 默认，harness 默认搜索会丢这些题。B5 必须二选一并写进文档：agent 默认改为 `REVIEWED+PUBLISHED`，或 publish 不改变 agent 默认可见性。
5. **A6「agent POST /api/questions → 403」正确。** `requireHumanApiAuth(..., { publishRoute: true })` 在读到 agent key 时返回 403 `Agent cannot publish questions`。无 cookie 的人是 401 `Unauthorized`。不要写成一种状态码。
6. **A6 E2E 环境。** Playwright `webServer` 不设 `EDITOR_SESSION_SECRET`。解锁成功用例依赖进程能读到 `.env`；CI/干净环境会 fail-closed。A6 应规定测试用 secret 的注入方式。

## Phase / PR 调整建议（不改 v1 边界）

发布切分改为：

| PR | 内容 |
| --- | --- |
| A1+A4 | 解锁页落到栈顶后，快进合进 master（或同一发布 PR） |
| A2 | 设计文档 + 本轮 kimi/grok 审计入 git |
| A3 | README / development.md 全文 sweep |
| A5 | `scripts/create-api-key.ts` |
| A6 | e2e：错误 secret 停在解锁页；正确 secret 进草稿；promote 无 KP → 400；agent POST /api/questions → 403 |

B 层：B3 写明「先补 KP/tag 写 API，再做管理 UI」。B5 关闭 NQ-2 时同步 agent 默认 status。C 层不动。

## Key Decisions

Kimi 的 6 条决策我同意。第 1、3 条按 Issue 1 收紧：**解锁页是合栈的前置，不只是 Phase B 的前置。**
