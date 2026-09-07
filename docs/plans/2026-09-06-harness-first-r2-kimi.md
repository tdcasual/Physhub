# Kimi Re-audit Round 2: Physhub Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md |
| Round | 2 |
| Verdict | Approve with issues |

## Executive Summary

本轮为全新审计：先通读修订后文档全文（1410 行，分三段用 sed 读完），再逐文件核对仓库。结论：上一轮 6 个 major 全部真正修住，不是纸面修正——auth 空洞表与 `app/api/**` 实际 13 条路由逐条吻合且加入「以全量枚举为准」验收原则；multipart 改 canonical hash 的规则写到了字段级；promote 以事务内条件 `updateMany` 为仲裁并明确 P2002→409；幂等改先插 `in_progress` 占位并规定失败删行；PR-0 单一 baseline 且后续 PR 被明文禁止再碰 schema；suggestion accept 定为事务内 replace-of-kind、重复 accept 幂等 200。12 个 minor/nit 也逐条落地。

但修订本身引入了几处新的内部不一致，均在「工程师按文档会写出互相矛盾的实现」这一档，没有 critical/major：状态机说 `NEEDS_REVIEW→DRAFT` 是 human-only，Draft 契约却给 agent 开了 `DRAFT ↔ NEEDS_REVIEW` 双向；promote 的内容校验被允许放在事务外，仲裁只挡 status 不挡内容；幂等占位行的「完成」未要求与业务写同一事务，崩溃会把 key 永久毒化；新错误串 `Draft is not updatable` 未进稳定错误表且状态码「400 或 409」不定；测试专用 header 绕过了文档刚建立的解锁限流故事。另有 2 个 nit。共 7 条 open（0 critical / 0 major / 5 minor / 2 nit），故 Verdict = Approve with issues——架构与 PR 顺序可批准，上述 7 条需文字级修订。

## Previous issues verification

- Issue 1（空洞清单漏 GET /questions/[id] 与 search）：**fixed**。空洞表今日全量 13 条与 `find app/api -name route.ts` 实际输出逐条一致；PR-1 文件列表、human-auth 测试行、威胁模型均已含这两条。
- Issue 2（multipart requestHash 矛盾）：**fixed**。明确两条 hash 路径；multipart = 文件内容 sha256 + originalName + mimeType + 标量字段，明文禁止 boundary/header 顺序。
- Issue 3（promote 竞态）：**fixed**。事务内 `updateMany ... WHERE status IN (...)` 为仲裁，`count===0`→409，P2002 on `promotedQuestionId`→409，测试表有并发 promote 要点。残留内容竞态见新 Issue 2。
- Issue 4（幂等 check-then-act）：**fixed**。先插 `in_progress` 占位，P2002 重读回放，失败删行允许重试，schema 加 `state`。残留崩溃窗口见新 Issue 3。
- Issue 5（migration 策略与 PR Plan 矛盾）：**fixed**。PR-0 为唯一 schema/migration PR，「后续功能 PR 禁止再改 schema / 禁止第二份 baseline / PR-7 不代做」写进了 Migration 策略、Key Decision 13 与 PR-7 描述三处，一致。
- Issue 6（suggestion accept 语义）：**fixed**。replace-of-kind + deleteMany 重建 + index 0 primary + 同事务 + 重复 accept 幂等 200 + 并发 LWW 各留 ReviewRecord，全部写明。
- Issue 7（只读 POST 被幂等误伤）：**fixed**。分界改为「是否产生业务写入」，工具总表有 Idempotency 列，search/get/list 为 no。
- Issue 8（any-of scope 冲突）：**fixed**。新增默认 `drafts:read`，`get_question_draft` 单 scope；明文禁止 `hasAnyScope` / `*`。
- Issue 9（REJECTED 不可达）：**fixed**。采用 (b)：`updateQuestionDraft({actor, input})` 分流，工作台加 Reject / Send back。但引入新矛盾，见新 Issue 1。
- Issue 10（OQ-2 漏 export 通道）：**fixed**。OQ-2 与威胁模型并列写明 export 默认 `teacher:true` 为同等级答案通道；v1 维持 OQ-2a。
- Issue 11（mock 形状对齐措辞）：**fixed**。改为「mock 是子集」，缺 id → 422，mock suggestion 不能 accept，UI 禁用 Accept。
- Issue 12（sourceRawAssetId 检查）：**fixed**。create/update/promote 三处均为 422 `Raw asset not found`，不依赖 P2003。
- Issue 13（解锁端点爆破/吊销）：**fixed**。CSPRNG（`openssl rand -hex 32`）、每 IP 5 失败/分钟 429、cookie 不可单张吊销写入威胁模型。限流绕过面见新 Issue 5。
- Issue 14（DEPRECATED「若已引入」）：**fixed**。回滚节改为「现有 `QuestionStatus.DEPRECATED`」，schema 第 41 行确认该值已存在。
- Issue 15（ARCHIVED 无入口）：**fixed**。状态机图后、约束表、Key Decision 18 三处一致标注「v1 无 archive 路由，状态预留」。
- Issue 16（403 文案两个版本）：**fixed**。默认 `Agent key not accepted on human routes`，publish/promote 特化 `Agent cannot publish questions`，错误表两条均列为测试锁定。
- Issue 17（IdempotencyRecord 保留策略）：**fixed**。90 天建议写入 Idempotency 节、数据模型、Observability 三处；注明 export responseBody 可能含整份导出。
- Issue 18（dev key 非恒定时间比较）：**fixed**。dev key / ApiKey hash / editor secret 统一 sha256 后 `timingSafeEqual`，明文禁止 `token !== configuredToken`（现 `lib/auth/agent-auth.ts:36` 确实仍是 `!==`，文档要求改）。

## What is solid

- **空洞枚举与仓库完全对齐**：`app/api/**` 实际 13 条 route.ts（11 human + 2 agent），文档空洞表、PR-1 文件列表、测试验收三处一致，无遗漏无虚构。grep 确认 11 条 human 路由今日全部无 auth 引用。
- **Schema 事实全部属实**：`QuestionDraft` 无 difficulty/KP/tags/promotedQuestionId（schema.prisma:136-153）；`AgentRun` 无 apiKeyId/requestId（274-289）；无 `IdempotencyRecord`；无 `prisma/migrations/`；`QuestionStatus.DEPRECATED`、`RawAssetStatus.ARCHIVED`、`DraftStatus.REJECTED/PROMOTED` 均已存在；`QuestionKnowledgePoint @@id([questionId, knowledgePointId])` 与 replace-of-kind 的动机吻合。
- **幂等与 promote 的并发设计现在是约束驱动**：先插占位 + P2002 重读、条件 updateMany 仲裁，两处都明文禁止 check-then-act，测试表有对应要点。
- **错误串与现有代码逐字核对通过**：`Malformed JSON request body` / `Search query is required` / `Knowledge point not found` / `Question not found`（question-set 422）/ `Unable to create question` / `Unable to search questions` / `Unable to create question set` / `Unable to export question set` / `Provide a non-empty file or text field` / 中文校验串（`题干不能为空`/`必须确认知识点`/`答案必须匹配选项`）均与实际代码一致。
- **安全策略事实准确**：`isSafeImageSrc` allowlist（`/assets/` `/uploads/` `/api/assets/`）、LaTeX 黑名单 8 命令 + 2 环境、export teacher 默认 true 输出 `答案：`/`解析：`、storage 拒绝绝对路径与 `..` 逃逸、search select 不含 answerJson、get 返回全量 DTO 的注释，均与代码一致。
- **Scope/认证设计自洽**：`drafts:read` 消解 any-of；`devAgentScopes` 确实缺 `drafts:update`/`drafts:read`（agent-auth.ts:1-9）；`hasRequiredScopes` 全命中语义与文档一致；方案 a 的 CSPRNG、限流、不可吊销、timingSafeEqual 四件套完整。
- **PR Plan 顺序正确**：PR-0 唯一 baseline → PR-1 关洞（过渡期内 human POST 仍走 createQuestion，已写明）→ PR-2 draft+幂等 → PR-3 promote（并认领 suggestion.questionId 回填，消解了上一轮的隐藏耦合）→ PR-4 accept → PR-5 wrapper → PR-6 skill → PR-7 文档 → PR-8 mock 降级。skill 不先于工具、MCP/LLM 不进 v1、mock 不当产品 AI，三条红线都守住。

## Issues

### Issue 1: Agent 能否 `NEEDS_REVIEW → DRAFT`：状态机与 Draft 契约互相矛盾
- Severity: minor
- Section: Hard Constraints → 状态机 / Agent Tool API Surface → Draft JSON 契约 / Human UI Changes
- Description: 状态机 mermaid 写 `Draft_NEEDS_REVIEW --> Draft_DRAFT: human send back`（human only），约束表 Agent 列也只有「`DRAFT` 创建；更新内容；可选标 `NEEDS_REVIEW`」，UI 节把 Send back 写成人类按钮。但 Draft JSON 契约写「`actor: "agent"` 只能 `DRAFT` ↔ `NEEDS_REVIEW`」——双向箭头明确允许 agent 把 NEEDS_REVIEW 改回 DRAFT。工程师按契约节实现会开放 agent send-back，按状态机实现会拒绝，两者都「忠于文档」。
- Evidence: 文档状态机段（`Draft_NEEDS_REVIEW --> Draft_DRAFT: human send back`）与约束表；Draft JSON 契约段（「agent 只能 `DRAFT` ↔ `NEEDS_REVIEW`」）。
- Suggestion: 二选一写死。若 send back 定为 human-only，把契约改为「agent 只能 `DRAFT → NEEDS_REVIEW`（单向）」；若允许 agent 回退，改状态机标注为 `agent/human`。前者与「human 主导校对节奏」的叙事更一致。
- Status: open

### Issue 2: Promote 的内容校验在事务外，仲裁只挡 status 不挡内容
- Severity: minor
- Section: Hard Constraints → Promote（human-only）
- Description: 文档明确「校验（可在事务外预读，但不能当作竞态裁决）」，事务内仲裁 `updateMany` 的 WHERE 只含 `status IN ('DRAFT','NEEDS_REVIEW')`。于是存在窗口：校验通过后、事务提交前，并发的人类 `PATCH /api/drafts/:id`（human 写路径无幂等要求）把题干/答案/知识点改成不合法内容；promote 仍按校验过的旧快照建 `REVIEWED` Question——未通过 `validatePublishableQuestion` 的内容进入正式题。文档「禁止 check-then-act」只覆盖了 status，没有覆盖内容。单操作者场景概率低，但文档自己把「工程师不会写出与文档相反的实现」当验收标准，而此处文档字面允许的实现就是有竞态的。
- Evidence: Promote 节「可在事务外预读」+ 仲裁步骤 1 的 WHERE 条件；human `PATCH /api/drafts/:id` 在 Human API 表中存在且只要求 status 非 PROMOTED/REJECTED。
- Suggestion: 二选一：(a) 事务内在仲裁成功后重读 draft 行，以重读内容跑 `validatePublishableQuestion` 并建 Question（校验失败则整体回滚、status 不翻转——与「校验失败不得翻转 status」兼容，因为同事务）；(b) 把 `updatedAt` 加入仲裁条件做乐观锁，预读后发现变更加 409。推荐 (a)，实现最简单。
- Status: open

### Issue 3: 幂等占位行的「完成」未要求与业务写同一事务，崩溃永久毒化 key
- Severity: minor
- Section: Hard Constraints → Idempotency-Key + request_id + AgentRun
- Description: 行为步骤 3：「执行业务写 + AgentRun。成功：同一行 `UPDATE state='completed'`」。文档没有要求业务写与 record 完成在同一个事务里。若进程在业务写提交后、`UPDATE completed` 前崩溃（或该 UPDATE 自身失败），该 key 永远停在 `in_progress`：之后所有重试在短轮询后只能得到 409 `Idempotency-Key in progress`——客户端既拿不到当初的成功响应，也不敢换新 key（会双写业务行）。该 key 要等 90 天人工清理才解锁。这是先插占位方案的已知边界，文档恰恰漏了这一句。
- Evidence: Idempotency 行为步骤 2-4（无任何「业务写 + completed 更新同事务」或「stale in_progress 回收」的句子）；对照 promote 节明确写了「一个 Prisma `$transaction`」，幂等节没有等价措辞。
- Suggestion: 补一句：业务写、AgentRun、record `completed` 更新应在同一事务提交（占位行在事务外先插，事务内更新同一条）；并为 stale `in_progress` 给恢复路径（如「`in_progress` 超过 N 分钟可视为失败，允许删除后重试」或启动时清理）。
- Status: open

### Issue 4: `Draft is not updatable` 未进稳定错误表，且状态码「400 或 409」不定
- Severity: minor
- Section: Agent Tool API Surface → 稳定 error 字符串 / Draft JSON 契约 / Quality / Tests
- Description: Draft 契约写「Agent 送 `REJECTED` / `PROMOTED` → 400 或 409 `Draft is not updatable`」，PATCH 工具合同写「已 `PROMOTED` / `REJECTED` → 409 `Draft is not updatable`」。问题有二：(1) 该字符串不在「稳定 error 字符串」表里（409 行只有 `Idempotency-Key reused...` / `Idempotency-Key in progress` / `Draft is not promotable`），而文档宣称错误串是测试锁定契约；(2) 「400 或 409」把两种语义混在一起——agent schema 的 zod enum 拒绝（body 非法，应为 400）与目标草稿状态冲突（409）是不同成因，测试表也写成「agent PATCH 同字段 → 400/409」，把歧义固化进验收。
- Evidence: 错误字符串表 409 行无 `Draft is not updatable`；Draft 契约「400 或 409」；测试表「Human 可 REJECTED；agent 不能」行的「400/409」。
- Suggestion: 拆成两条契约：body 里 status 值超出 agent 枚举 → 400（zod 校验文案或新增稳定串，如 `Invalid draft status`）；目标草稿已 PROMOTED/REJECTED → 409 `Draft is not updatable`。两条都进错误表，测试分别锁定。
- Status: open

### Issue 5: 测试 header `X-Physhub-Editor-Session` 绕过解锁限流，生产行为未定义
- Severity: minor
- Section: Auth → Human auth 方案 a / Threat model（解锁端点爆破行）
- Description: 方案 a 用「`POST /api/auth/editor-session` 每 IP 5 失败/分钟 → 429」作为爆破缓解。但 `readEditorSession` 在 cookie 缺失时读 `X-Physhub-Editor-Session` header，「值仍是 secret 或同一 HMAC」——即每条 human 路由都提供了一次无限速的 secret 比对机会，攻击者根本不用打解锁端点，429 形同虚设。文档没说要限制：该 header 是否生产可用、是否仅 `NODE_ENV !== "production"` 启用、是否与解锁端点共用限流计数。256 位 CSPRNG secret 下在线爆破本不可行，所以实际风险低，但文档的缓解叙事与机制自相矛盾。
- Evidence: 方案 a 实现列表（header「仅方便 Vitest」但未限制环境）；威胁模型「解锁端点爆破」行只列了端点限流。
- Suggestion: 补一句：`X-Physhub-Editor-Session` 仅在非 production 生效（或仅当显式 `EDITOR_SESSION_TEST_HEADER=1`），production 忽略；或者明说「限流只防弱 secret 场景，CSPRNG 强制后爆破不在威胁模型内」。二选一即可。
- Status: open

### Issue 6: 同一错误串跨 404/422 两个状态码，缺少映射规则
- Severity: nit
- Section: Agent Tool API Surface → 稳定 error 字符串
- Description: `Raw asset not found` 同时出现在 404 行（GET-by-id 语境）和 422 行（draft `sourceRawAssetId` / promote 引用语境）；`Question not found` 同时出现在 404 行与 question-set 未知成员的 422（现有 `mapQuestionSetApiError` 确实如此）。同串双状态本身可用，但文档没写映射规则，契约测试需要自己猜「哪个语境配哪个码」。
- Evidence: 错误表 404 行与 422 行；`app/api/question-sets/route.ts:26-28`（422 `Question not found`）。
- Suggestion: 加一句规则：「id 在 path 中 → 404；id 在 body 中被引用 → 422」，与现有 question-set 行为一致。
- Status: open

### Issue 7: Promote「复用 `buildPersistedQuestionContract`」会丢 `sourceRawAssetId` 与 tags
- Severity: nit
- Section: Hard Constraints → `createQuestion` 对 Agent 不可调用 / Promote 步骤 2
- Description: 文档说 promote「内部可复用 `buildManualPublicQuestionId`、`buildPersistedQuestionContract`、知识点 relation create」。但 `buildPersistedQuestionContract` 的返回类型 `PersistedQuestionContract` 只 Pick 了 type/stem/options/answer/solution/difficulty/primaryKP/status——不含 `sourceRawAssetId`，且现有 `createQuestionWithCandidate` 不建 `QuestionTag` join。而 promote 步骤 2 的字段列表明确要 `sourceRawAssetId` 与 `tags`。照字面「复用」会静默丢这两个字段。
- Evidence: `lib/domain/question-repository.ts:30-40`（Pick 列表）、77-90、147-157（无 tags create）；文档 Promote 步骤 2 字段列表。
- Suggestion: 把「复用」改为「复用其 shape 并扩展 `sourceRawAssetId` 与 tags join」，或在 promote 步骤 2 注明这两个字段在 helper 之外补齐。
- Status: open

## PR Plan review

顺序与切分在修订后已无明显结构性问题：

- **PR-0 唯一 baseline** 解决了上一轮最大的流程矛盾；「功能 PR 禁止再碰 schema」在 Migration 策略、Key Decision 13、PR-7 三处口径一致。PR-1「可不依赖 PR-0」的注解（auth 不需要新表）务实且正确。
- **PR-1 过渡期设计**（human POST /api/questions 暂仍走 createQuestion）与 Goal 3「唯一插入入口是 promote」存在文档内已声明的张力——文档自己标注了「PR-1 过渡、PR-3 切换」，属于有管理的临时态，不算矛盾；但过渡期创建的正式题没有 QuestionVersion/ReviewRecord，审计面有一个已知缺口，建议在 PR-1 描述里补一句「过渡期题目在 PR-3 后无 version 历史，属已知接受」。
- **PR-2 自含幂等**（表由 PR-0 提供）修复了上一轮「PR-2 要幂等但表在 PR-5」的死锁，正确。
- **PR-3 认领 suggestion.questionId 回填**（「PR-4 依赖此行为，必须在本 PR 认领」）消解了上一轮的隐藏耦合，好。
- **PR-5 范围观察（非问题）**：`create_raw_asset` agent 路由在 PR-5，而 PR-2 的 draft create 已接受 `sourceRawAssetId`——PR-2 期间 agent 无法走通「先传素材再挂 draft」的完整链路（只能靠 human 上传或不带 source）。文档工作流图以上传开始，不影响正确性，但 PR-2 的验收演示需注意这一点；skill 在 PR-6 才写，届时链路已完整。
- **PR-8 依赖 OQ-3 拍板**已写明，mock 产出不能 accept 的衔接清楚。
- 每个 PR 有文件清单与测试落点，颗粒度可开工。新引入的字段（draft Json 列、promotedQuestionId、AgentRun 两列、IdempotencyRecord.state）、新 scope（`drafts:update`/`drafts:read`）、新错误串（除 Issue 4 的 `Draft is not updatable` 外）均有测试落点。

## Fact-check vs repo

方法：sed 三段读完全部 1410 行；逐文件核对下列路径。结论：**抽查通过**，文档对现状的陈述全部属实，未发现新的事实性错误（上一轮的两处轻微事实误差——mock 形状、DEPRECATED 已存在——均已修正且与代码一致）。

已核对文件与结论：

- `prisma/schema.prisma` — 模型/enum 全对齐；`QuestionDraft` 无四个 additive 字段；`AgentRun` 无 apiKeyId/requestId；无 `IdempotencyRecord`；`DEPRECATED`/`ARCHIVED`/`REJECTED`/`PROMOTED` 均已在 enum；`QuestionKnowledgePoint @@id` 与 `role @default("secondary")` 属实。
- `lib/auth/agent-auth.ts` — `devAgentScopes` 缺 `drafts:update`/`drafts:read` 属实；第 36 行确为 `token !== configuredToken`；`hasRequiredScopes` 为全命中。
- `lib/domain/question-repository.ts` — `createQuestion` 经 `buildPersistedQuestionContract` 写死 `status:"REVIEWED"`（88 行）属实；`buildManualPublicQuestionId` 含 P2002 重试属实；helper 不含 sourceRawAssetId/tags（新 Issue 7）。
- `lib/domain/question-schema.ts` — `validatePublishableQuestion` 接受 Partial、五条中文错误串逐字一致；`answerMatchesOptions` label 语义属实。
- `lib/domain/question-service.ts` — `normalizeQuestionInput` label 转大写（23 行）属实。
- `lib/domain/suggestion-policy.ts` — `canSuggestionWriteDirectlyToQuestion` 只看 `actor === "human"` 属实。
- `lib/domain/question-set-service.ts` — `title is required` / `questionIds must be a non-empty array` / 未知 question → `QuestionSetRelationError("Question not found")` 属实。
- `lib/domain/taxonomy-repository.ts` — `buildKnowledgePointsResponse` / `knowledgePointSelect`（id/name/slug/parentId/sortOrder）/ `tagSelect`（id/name/slug/group）与文档逐字一致。
- `lib/search/question-search.ts` — `questionSearchSelect` 不含 `answerJson` 属实；`Search query is required` 串属实（经 `app/api/search/questions/route.ts`）。
- `app/api/**` — 全量 13 条 route.ts 与文档空洞表一一对应；grep 确认 11 条 human 路由无任何 auth 引用；`GET /api/questions/[id]` 返回 `getQuestion` 全量 DTO（含 answerJson）属实；agent 两条路由 401 `Unauthorized` 契约属实；suggestions PATCH 只改 status + ReviewRecord 属实；export 同步 `SUCCEEDED`、`teacher !== false` 默认属实；raw-assets 无限制、空 `file.type` fallback octet-stream 属实。
- `lib/renderer/render-markdown.tsx` — 图片 allowlist 三前缀属实，rehype-sanitize 在用。
- `lib/renderer/export-question-set.ts` — 8 条命令黑名单 + `document`/`questions` 环境黑名单逐字属实；teacher 模式输出 `答案：`/`解析：` 属实。
- `lib/storage/storage-service.ts` — 拒绝绝对路径与 `..` 逃逸属实。
- `components/question/question-editor.tsx` — 纯本地 useState demo 题（v-t 例题与文档示例同源）属实。`components/draft/draft-review-workspace.tsx` — 编辑纯本地、无 save/promote/fetch 属实。
- `lib/workers/mock-classification-agent.ts` — `MetadataSuggestion` 无 `id`/`tag_ids` 属实，与文档「子集」措辞一致。
- `prisma/seed.ts` — OWNER `owner@example.com`、4 知识点（含 `vt-area-displacement`）、4 tag（含 `image-question`）属实。
- `package.json` / `docs/development.md` / `.env.example` — `db:migrate: prisma migrate dev`、`development.md:30` 假设 `--name init`、`.env.example` 有 `AGENT_API_KEY_DEV` 无 `EDITOR_SESSION_SECRET`，均属实；Prisma 7.8 + adapter-pg 属实。
- 无 `prisma/migrations/`、无 `middleware.ts` — 属实。
- `tests/unit/` 下文档引用的基准测试文件（`agent-routes.test.ts`、`question-api-contract.test.ts`、`suggestion-review-route.test.ts`、`agent-auth.test.ts` 等）均存在。
