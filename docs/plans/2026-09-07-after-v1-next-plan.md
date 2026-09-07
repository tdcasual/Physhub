# Physhub 下一阶段方案（v1 之后）

| 字段 | 值 |
| --- | --- |
| 日期 | 2026-09-07 |
| 状态 | Shipped on `master`（`a730708`；R2 Approve 后落地并快进合栈） |
| 前置 | [2026-09-06 harness-first](./2026-09-06-harness-first-agent-platform.md) 已交叉审计通过并按 PR-0…8 落地 |
| 当前代码 | GitHub `master` / `a730708`。harness-first 栈 + after-v1 工作台已合入。 |
| 单测 | `npm test`：44 files / 374 passed（需 `prisma generate`） |
| R1 审计 | [Kimi](./2026-09-07-after-v1-kimi-audit.md) Approve with issues；[Grok](./2026-09-07-after-v1-grok-audit.md) 同源码闭合 Doubts |
| R2 审计 | [Kimi](./2026-09-07-after-v1-r2-kimi.md) Approve 0/0；[Grok](./2026-09-07-after-v1-r2-grok.md) Approve |

---

## R1 已吸收（本版相对初稿）

| 来源 | 处理 |
| --- | --- |
| Kimi I1 major | **否决「先合栈、后解锁」**。解锁页在栈顶落地并锁 RSC 读之后，再快进 master。 |
| Kimi Doubt 2 / Grok | A4 写死：无 cookie **不得查 Prisma、不得把 draft/question 序列化到客户端**，不只藏 Promote。 |
| Kimi I2 minor | A6 拆开：无知识点 → **400**；id 不存在 → **422**。不是把 400 改成 422。 |
| Kimi I3 nit | A3 改为 README + `docs/development.md` **全文 sweep**，不按三句清单替换。 |
| Grok | B3 先补 KP/tag **写 API**（现仅 GET）；B4 上传 API 已在，只补 UI；B1 的 `QuestionVersion` 表已在 promote 写 v1，PATCH 是 n+1。 |
| Grok | 关闭 NQ-1b、关闭 NQ-2：B5 把 agent 默认搜索改为 `REVIEWED+PUBLISHED`。 |
| Grok | A6：人无 cookie → 401；agent 打 human 发布路由 → 403；Playwright 必须注入测试用 `EDITOR_SESSION_SECRET`。 |
| Grok R2 预修 | A4 **选定 page 级门卫**。Next 16 layout 不渲染 `{children}` 仍会执行 page（#88472）；现有 dashboard page 在函数里直接 prisma，只加 layout 锁不住读。不把 `human-auth.ts` 整文件丢进 Edge middleware。 |

---

## Overview

v1 的领域闭环和工作台已在 **`master`** 上：外部 harness 只写 Draft / Suggestion，人 promote 才插入正式 `Question`，解锁页锁读、Agent API、幂等、HMAC session、题图鉴权读取、skill 手册、正式题 PATCH、组题篮、知识点写 API 都在。**下一步不是再加模型，也不是上 MCP / Meilisearch。**

分层（A、B 已落地；C 仍等使用证据）：

1. **把 v1 变成可发布的主线** — 已合 `master`。
2. **让老师不用 curl 也能用** — 已合；体验仍粗（知识点逗号 id、组题篮内存）。
3. **再谈检索增强和分发层**（全文搜索、MCP、OCR 服务）— 未做。

第 3 层在没跑通一次真实 Postgres promote 之前不做。

---

## 当前真实缺口（以 `master` 为准）

已合入、可依赖：

- Human API 全部门；agent 打 `POST /api/questions` → 403；人无 cookie → 401。Dashboard page 级解锁，无 cookie 不查 Prisma。
- Draft CRUD、promote、suggestion accept、agent wrappers、skill、`ENABLE_MOCK_*` 默认关。
- 正式题 human PATCH + `QuestionVersion` n+1；KP/tag 写 API 与 `/taxonomy`；组题篮 UI；人用上传控件。
- 教师搜索与 agent 默认 `REVIEWED+PUBLISHED`。`scripts/create-api-key.ts` 已在。方案文档已跟踪。

还开放（不挡「能用」，挡「好用 / 已验收」）：

| 缺口 | 影响 |
| --- | --- |
| Playwright Chromium 在部分环境装不上；E2E 不含 promote | 解锁/KaTeX 规格在仓库里，真实浏览器绿未在本环境证明 |
| 真实 Postgres promote | **API 主链路已在本地 Postgres 跑通**（解锁 → draft → promote → 搜索命中 → agent 403）。Playwright 浏览器仍未绿 |
| 知识点编辑是逗号 id；组题篮刷新即丢 | 老师体验粗 |
| 对外导出未强制 `PUBLISHED` | B5 文档写了，代码仍导出篮中题目 |
| 首页/手册曾有过期句 | 已扫 README；首页与本文表头需与 `master` 同步 |

明确仍不做（沿用 v1 边界）：

- Next.js 内嵌 LLM / OCR。
- MCP Server、Meilisearch、Redis/BullMQ、Python worker。
- 多租户、NextAuth、公开题库市场。

---

## Phase A — 发布 v1（先做完再谈功能）

目标：`master` 上就是能解锁、能 promote、文档与代码一致的 harness-first 工作台。

**顺序约束：A4 →（A2 / A3 / A5 可并行）→ A6 → A1。禁止 A1 早于 A4。** 所有 A 项先落在当前栈顶分支（或从其快进的工作分支）上，最后一次快进 `master`。

### A4. 解锁页（合栈前置；锁读不只藏按钮）

这是老师可用性与读侧保密的最大洞。必须在快进 `master` 之前落地。

**不要**把「layout 不渲染 `{children}`」当成锁读手段。Next 16 App Router 仍会并行执行 page（vercel/next.js#88472）；现在的 `questions/page.tsx`、`drafts/page.tsx`、`drafts/[id]/page.tsx` 在模块函数里直接 `prisma.*`，layout 省略 children **挡不住查库和 RSC 序列化**。仓库目前也没有 `middleware.ts`。`lib/auth/human-auth.ts` 用 `node:crypto` 且会动态 import prisma，不能整文件丢进 Edge middleware。

**选定：page 级门卫。** 抽 `readEditorSessionFromCookies()`（`cookies()` + 与现有相同的 HMAC 公式 + `timingSafeEqual`，不查 User 表以外的业务数据；无 cookie 返回 null）。四个 dashboard page 的**第一件事**是 await 它：

- 无效：立刻 `return <UnlockForm />`，**其后不得**调用 prisma，也不得把 draft/question 字段传给 client component。
- 有效：再查库、再渲染现有 UI。

覆盖：`/questions`、`/drafts`、`/drafts/[id]`、`/questions/new`。`/` 在 `(dashboard)` 外，保持公开落地页。

`UnlockForm` 是 client 组件：`POST /api/auth/editor-session` `{ secret }`（已有路由：401 / 429 / Set-Cookie），成功后 `location.reload()`。不把 `EDITOR_SESSION_SECRET` 放进任何客户端 bundle。失败展示服务端 401 / 429 文案。

可选：`(dashboard)/layout.tsx` 只做解锁后的壳，不算门卫。需要 Edge 预拦截时再加 middleware，HMAC 必须用独立的 Web Crypto 小函数，不 import `human-auth.ts` 全文。v1 不要求 middleware。

Nav 可留在根 layout（未解锁也能看见链接）；点进去只看到解锁表单。

现有 `tests/unit/questions-page.test.tsx`、`drafts-page.test.tsx` 直接 `render(await Page())` 且 mock 的是 prisma。A4 必须 mock session helper 为已解锁，并加「无 cookie → 出现解锁表单、prisma 零调用」用例。

### A2. 提交设计文档

纳入 git（可与 A3 同一 docs PR）：

- `docs/plans/2026-09-06-harness-first-agent-platform.md`
- `docs/plans/2026-09-06-harness-first-agent-platform-kimi-audit.md`
- 各轮 `r2`–`r5` 审计（可只留 kimi-audit + 本文；其余作附录）
- 本文 `docs/plans/2026-09-07-after-v1-next-plan.md`
- `docs/plans/2026-09-07-after-v1-kimi-audit.md`、`2026-09-07-after-v1-grok-audit.md`
- `docs/plans/2026-09-07-after-v1-r2-kimi.md`、`2026-09-07-after-v1-r2-grok.md`

### A3. 文档追上栈顶（全文 sweep）

不要只替换三句。对 README 与 `docs/development.md` 按关键词扫完：`not yet` / `Today` / `lands` / `upcoming` / `still unauthenticated` / `this branch`。

已知必须改掉的句子包括但不限于：

- README Setup：「this branch does not yet reject requests if it is missing」
- README Secrets：「Those routes are still unauthenticated on this branch」
- README Agent skill：「That package lands in a later PR」（文件已在 `skills/physhub/SKILL.md`）
- README Drafts：「Today that POST still writes a `REVIEWED` question directly」
- README mock：「Today those routes still run unauthenticated」
- `docs/development.md`：「Promote is upcoming.」
- `docs/development.md`：「this branch does not yet reject unauthenticated human requests」

改成与栈顶一致：human API 无 cookie → 401；agent 打发布路由 → 403；promote 是正式插入路径；skill 已在；mock 路由要 human session 且 `ENABLE_MOCK_*` 默认关。

### A5. 生产钥匙脚本

补 `scripts/create-api-key.ts`（仓库现在没有 `scripts/`）：

- 打印一次 `phk_` + 32 bytes hex。
- DB 存 sha256 hex。
- 默认保守 scope（与 `devAgentScopes` 对齐，含 `drafts:update` / `drafts:read`）。
- 拒绝写入 `questions:publish` / `delete` / `metadata:write`，除非 `--i-understand-high-risk`。

### A6. 一次真实主链路验收

在本地 Postgres + 浏览器（桌面与窄屏）：

```text
解锁 → New draft 保存 → 校对台改题 → Promote
→ /questions 可见 → 自然语言搜索命中
→ harness：Bearer 建 raw asset + draft + quality-check
→ agent POST /api/questions → 403 Agent cannot publish questions
→ 无 cookie 打开 /drafts/[id] → 只有解锁表单，响应里没有 answerJson
```

E2E（`playwright.config.ts` 的 `webServer.env` **显式注入**测试用 `EDITOR_SESSION_SECRET`，不要赌开发者 `.env` 一定存在）至少覆盖：

| 用例 | 期望 |
| --- | --- |
| 错误 secret | 仍在解锁页；401 或 429 |
| 正确 secret | 能进草稿列表 |
| 无 cookie 打开 `/drafts/[id]` | 无答案字段出现在 DOM / RSC payload |
| promote 未选知识点 | **400**，文案含「必须确认知识点」 |
| promote 知识点 id 不存在 | **422** `Knowledge point not found`（可用 API 测，不必全走 UI） |
| agent Bearer `POST /api/questions` | **403** `Agent cannot publish questions` |
| 无 cookie `POST /api/drafts` | **401** `Unauthorized` |

现有 `smoke.spec.ts`（KaTeX）保留；它不查库，不能替代本表。

### A1. 合栈（最后一步）

前置：A2、A3、A4、A5、A6 都已在栈上。

**NQ-1a（选定）：** 快进栈顶进 `master`，一个合并。`master` 已是栈的祖先（17 commit），快进不会分叉。

```text
master  ←  （含解锁页与 A6 的栈顶）
```

**NQ-1b 否决：** 不要开 9 个独立 GitHub PR 再 rebase。分支已在 origin，需要按层看 diff 时用 compare URL。

验收：`master` 含 migration、auth、draft、promote、agent 工具、skill、解锁页、create-api-key、跟上代码的 README。clone 后按 README 能解锁并 promote。

**Phase A 完成标准：** GitHub `master` 可 clone、migrate、seed、dev；老师用解锁页能 promote 一道题且未解锁看不到答案；harness 用 skill 能建草稿且不能发布。

---

## Phase B — 老师日常工作台

目标：常用操作不再依赖 curl / harness。仍不内嵌模型。A 全部完成（含已在 master 上解锁 promote）才开 B。

### B1. 正式题内容修订（关闭 OQ-6）

**选定：原地 human PATCH + 已有 `QuestionVersion` 的 n+1。**

- 仅 editor session。Agent 无此工具、无 `/api/agent/questions/:id` 的 PATCH。
- 表已在；promote 已写 `version: 1`。本 PR **不新建表**。
- 改 `stemMd` / options / answer / solution 时：`validatePublishableQuestion`，同一事务写 Question + `QuestionVersion` n+1（`createdById`）。
- 不新开草稿，避免「同一题两个 publicId」。
- Metadata 仍只走 suggestion accept 或本 PATCH 里显式字段（与 v1 accept 规则一致）。
- UI：`/questions/[id]` 教师编辑页，Save 出版本。该页同样受 A4 dashboard 门约束。

否决：每次改字都 clone 新草稿。否决：agent 改正式题干。

### B2. 组题篮与导出 UI

`POST /api/question-sets` 与 `POST /api/question-sets/:id/export` 已有。补：

- 从搜索/列表把题加入篮（client state，刷新即丢；见 NQ-3）。
- 创建 `QuestionSet`、预览、导出 Markdown/LaTeX（教师/学生开关）。
- 不在 UI 里给 agent key 输入框。

### B3. 知识点与标签管理

**先补 human 写 API，再做 UI。** 现状只有 GET。

- `POST/PATCH/DELETE /api/knowledge-points`、`/api/tags`：`requireHumanApiAuth`，无对应 agent 工具。
- 禁删仍被正式题（或草稿 JSON 里仍引用）的节点 → **409**。
- 标签 name/slug/group。
- Agent 仍然只能 `GET /api/agent/knowledge-points` 与 tags，不能 invent id。

OQ-5：v1 草稿 KP 继续 JSON 数组。只有「按知识点列未 promote 草稿」成为刚需时再加 join 表。

### B4. 人用上传与原图

不新做上传服务。`POST /api/raw-assets` 与 `GET /api/raw-assets/:id/file` 已鉴权。

- New draft / 校对台：选文件或粘贴文本 → 现有 POST，再 PATCH 草稿 `sourceRawAssetId`。
- 左栏继续走 file GET。
- 不做 PDF 批量切题。

### B5. 正式题状态 UI（同时关闭 NQ-2）

v1 schema 已有 `PUBLISHED` / `DEPRECATED`。补 human-only 状态转换（建议挂在 B1 的 `/questions/[id]`）：

- Publish：`REVIEWED → PUBLISHED`。含义：reviewed=入库；published=可用于对外讲义。
- Deprecate：退出所有默认搜索。无物理删除。
- Agent 无这些工具。

**NQ-2 选定（B5 一次性改完，避免 publish 后 harness 丢题）：**

| 面 | 默认 `status` |
| --- | --- |
| 工作台列表 / 教师搜索面板 | `REVIEWED+PUBLISHED`（现在已是） |
| Agent 省略 `constraints.status` | **改为** `REVIEWED+PUBLISHED`（现在是只有 `REVIEWED`；B5 改 `lib/search/question-search.ts` 与 `skills/physhub/SKILL.md`） |
| 对外/课时导出 | 要求 `PUBLISHED`（新约束，默认关闭；教师显式打开） |
| `DEPRECATED` | 任何默认都不含；只能显式传入 |

---

## Phase C — 以后才做（有使用数据再开）

| 项 | 触发条件 |
| --- | --- |
| Meilisearch / 全文索引 | 题量到 Postgres `ILIKE` 明显漏检或变慢 |
| MCP Server | 某个客户端不能走 HTTP+skill |
| 独立 OCR/Python worker | 扫描件 harness 稳定看不清，且不想把模型密钥放进 Next |
| NextAuth / 多用户 | 第二个老师要独立审计 `actorId` |
| 收紧 OQ-2（预览 DTO + export 去答案） | 出现非教师 harness 或题库有保密要求；必须 **同时** 收紧 get 与 export |
| 持久 cookie / session 表 | 老师抱怨关浏览器就掉线，且接受轮换 secret 不再够用 |
| PDF 导出 | Markdown/LaTeX 不够发讲义 |

C 层任何一项都不得回头削弱「agent 不能 promote」。

---

## 建议的 PR 切分（A + B）

A 在栈上做完再快进 master。B 全部依赖 A1。

| PR | 标题 | 依赖 |
| --- | --- | --- |
| A4 | `feat: editor session unlock gate for dashboard RSC` | 栈顶 |
| A2 | `docs: commit harness-first design, next-plan, and audits` | 栈顶 |
| A3 | `docs: sweep README and development.md to shipped auth` | 栈顶 |
| A5 | `feat: create-api-key script` | 栈顶 |
| A6 | `test: e2e unlock, draft save, promote statuses` | A4 |
| A1 | `chore: fast-forward harness-first v1 (with unlock) to master` | A2 A3 A4 A5 A6 |
| B1 | `feat: human patch official questions with version n+1` | A1 |
| B2 | `feat: question set basket and export UI` | A1 |
| B3 | `feat: knowledge point and tag write APIs and admin UI` | A1 |
| B4 | `feat: human raw asset upload in draft workspace` | A1 |
| B5 | `feat: publish/deprecate and agent search default REVIEWED+PUBLISHED` | B1 |

A2 / A3 / A5 可并行。A4 可与它们并行。A1 是唯一碰 `master` 的 PR。

---

## Key Decisions

1. **先把可发布的栈（含解锁页）做完，再快进 master。** 未进 master 的 B 功能 PR 会在错误基线上分叉；但「先合栈」不得把一个不能登录的 master 发布出去。
2. **下一阶段仍不内嵌模型。** 价值在工作台，不在再包一个聊天框。
3. **解锁页是合栈前置，不只是 B 的前置。** 无 cookie 时 dashboard **page 在 prisma 之前 return 解锁表单**；不把「layout 省略 children」当成锁读。
4. **OQ-6 选定原地版本化编辑。** 人改正式题；agent 仍不能。用已有 `QuestionVersion` n+1。
5. **OQ-2 / OQ-3 / OQ-5 维持 v1。** 2a 全量答案、3b 夹具默认关、草稿 KP 用 JSON。
6. **MCP / Meilisearch / OCR worker 列为 C，有使用证据再开。**
7. **B5 关闭 NQ-2：** agent 默认搜索改为与工作台相同的 `REVIEWED+PUBLISHED`，以免 publish 把题从 harness 默认结果里藏掉。

---

## Open Questions（本阶段仅这些）

### NQ-1. 合栈方式 — 已关

- **NQ-1a（选定）：** 含解锁页的栈顶快进 `master`，一个合并。
- **NQ-1b（否决）：** 9 个 compare URL 各自开 draft PR。

### NQ-2. Publish 与默认搜索 — 已关

见 B5 表。工作台与 agent 默认都是 `REVIEWED+PUBLISHED`；对外导出才要求 `PUBLISHED`。

### NQ-3. 组题篮持久化

- **推荐 v1.1：** 浏览器内存。刷新即丢。
- 以后：用户级 QuestionSet draft。

---

## 成功标准

Phase A 成功 = 从 GitHub `master` clone 后，按 README 能：

```text
设好两个 secret
→ 打开站点，输入 editor secret
→ 未解锁时 /drafts/[id] 看不到答案
→ 保存并 promote 一道带 LaTeX 的题
→ 搜索能找到
→ 用 skill 让 harness 建草稿
→ harness 无法发布（403）
```

Phase B 成功 = 老师不离开浏览器也能：改已入库的题（出 n+1 版本）、组一套题并导出、加一个知识点、上传一张题图、把题标成 published。

---

## References

- `docs/plans/2026-09-06-harness-first-agent-platform.md`
- `docs/plans/2026-09-07-after-v1-kimi-audit.md`
- `docs/plans/2026-09-07-after-v1-grok-audit.md`
- `docs/plans/2026-09-07-after-v1-r2-kimi.md`
- `docs/plans/2026-09-07-after-v1-r2-grok.md`
- `skills/physhub/SKILL.md`
- 栈顶分支 `execute-plan/2151bf2e-pr-8-demote-mock-workers-to-test-fixtures`
- 原里程碑 MVP4 中未做项：Meilisearch、MCP、PDF（现归 Phase C）
