# Kimi Audit: Physhub Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md |
| Verdict | Approve with issues |

## Executive Summary

方案整体可落地：架构方向（harness-first、机器写路径收敛到 `/api/agent/*`、promote 作为正式题唯一插入入口、skill 不当权限系统）与仓库现状高度吻合，PR 顺序正确（先关安全洞、skill 在工具之后、MCP/模型不进 v1），文档对现有代码的事实陈述经逐文件核对基本属实。最大风险不在方向而在三处实现级漏洞如果按字面照写会产生真实 bug：promote 与幂等记录两处 check-then-act 竞态会导致重复正式题/重复草稿，multipart 上传的 `requestHash` 规则与 multipart 编码事实矛盾会导致合法重试被 409 拒绝，以及「必须关闭的现有空洞」清单漏掉了现存的无认证 `GET /api/questions/[id]`（含答案全量 DTO）。这些问题都能在不改变架构的前提下修正，故结论为 Approve with issues。

## What is solid

- **现状陈述准确（Background & Motivation → 当前仓库状态）**：逐条核对通过。`POST /api/questions` 确实无认证且 `createQuestion` 经 `buildPersistedQuestionContract` 写死 `status: "REVIEWED"`（`lib/domain/question-repository.ts:77-90`、`app/api/questions/route.ts:42-55`）；`devAgentScopes` 确实缺 `drafts:update`（`lib/auth/agent-auth.ts:1-9`）；Suggestion PATCH 只改 status + ReviewRecord，且测试确实断言 `question.update` 未被调用（`app/api/suggestions/[id]/route.ts`、`tests/unit/suggestion-review-route.test.ts`）；确实没有 `prisma/migrations/`、没有 `middleware.ts`；`EDITOR_SESSION_SECRET` 等引用与 `.env.example` 一致。
- **状态机与 Prisma enum 完全对齐（Hard Constraints → 状态机）**：`DraftStatus` / `QuestionStatus` / `RawAssetStatus` / `JobStatus` 与 `prisma/schema.prisma` 逐一吻合；`Suggestion.status` 保持 string 的决定与现有路由一致，避免无谓 migration。
- **Additive 字段确实是最小且必要的（Data Model）**：`QuestionDraft` 目前确无 `difficulty` / `knowledgePointIds` / `tagIds` / `promotedQuestionId`；`AgentRun` 确无 `apiKeyId` / `requestId`；`IdempotencyRecord` 为新表。没有偷着重做已有模型。
- **唯一写路径设计自洽（`createQuestion` 对 Agent 不可调用、Promote）**：`promoteDraftToQuestion` 复用 `buildManualPublicQuestionId`（含 P2002 重试）与 `buildPersistedQuestionContract` 是可行的；「手工给 ApiKey 加 `questions:publish` 也没有对应 handler」的防御深度写得明确且可测试。
- **Suggestion accept 字段表无歧义（Suggestion accept 写哪些字段）**：哪些字段写、写到哪里（Question join 表 vs draft Json）、哪些留在 payload，均有明确归属；`risks` 不落 Question 的决定正确。
- **草稿不完整可存、promote 才跑 `validatePublishableQuestion`（Draft JSON 契约）**：与 `QuestionDraft` 全 nullable 字段及 `validatePublishableQuestion` 接受 `Partial<QuestionInput>` 的现实现（`lib/domain/question-schema.ts:106-136`）兼容；中文错误串（如 `答案必须匹配选项`）与实际一致。
- **错误契约与现有风格一致（Agent Tool API Surface）**：`Malformed JSON request body` / `Search query is required` / `Knowledge point not found` / 500 文案均与 `mapQuestionApiError`、`parseQuestionSearchRequestBody`、`QuestionRelationError` 实际输出相符。
- **安全策略不外扩（已有渲染/导出安全策略：保持）**：`isSafeImageSrc` allowlist 与 `BLOCKED_LATEX_COMMANDS`/`BLOCKED_LATEX_ENVIRONMENTS` 与 `lib/renderer/*` 实际内容一致，且正确地不在 v1 重构。
- **Skill 定位正确（Skill Package）**：明确「skill 是操作手册、运行时不加载、安全测试不读 skills/」，PR-6 排在工具之后，避免了把手册当权限系统的经典错误。
- **migration 必要性判断正确（Migration 策略）**：仓库零 migration 属实；「第一次 additive schema 落地时必须提交 migrations」的原则本身是对的（但见 Issue 5 的内部矛盾）。

## Issues

### Issue 1: 「必须关闭的现有空洞」清单漏掉了无认证的 `GET /api/questions/[id]` 与 `POST /api/search/questions`
- Severity: major
- Section: Auth → 必须关闭的现有空洞
- Description: 空洞清单逐路由列举了 `POST /api/questions`、`raw-assets`、`suggestions`、`question-sets`、`GET /api/questions`、taxonomy GET，但没有列 `GET /api/questions/[id]`。该路由现存、无认证、且返回 `getQuestion` 的全量 DTO（含 `answerJson`）。若 PR-1 按清单字面实现，这条人类侧路由会继续匿名暴露全部答案——比文档特意保留的 agent `get_question`（至少还要求 Bearer + `questions:read`）更松。同理 human 侧 `POST /api/search/questions`（现存，无认证）也未列入清单。
- Evidence: `app/api/questions/[id]/route.ts`（无 auth，返回完整 question）；`app/api/search/questions/route.ts`（无 auth）；设计文档「必须关闭的现有空洞」表与 PR-1 文件列表均未提及这两条路由。
- Suggestion: 在空洞清单和 PR-1 文件列表中补上 `app/api/questions/[id]/route.ts`（GET 需 human session）与 `app/api/search/questions/route.ts`（同上）；加一条「路由清单以 `app/api/**` 全量枚举为准」的验收要求，防止 PR-1 只关表里列出的洞。
- Status: addressed
- Response: 已把今日 `app/api/**` 全量列入「必须关闭的现有空洞」表（含 `GET /api/questions/[id]` 与 `POST /api/search/questions`），并写明验收以目录枚举为准。PR-1 文件列表、human-auth 测试与威胁模型同步补上这两条匿名答案/检索通道。

### Issue 2: Idempotency 的 `requestHash` 规则与 multipart 上传互相矛盾
- Severity: major
- Section: Hard Constraints → Idempotency-Key + request_id + AgentRun
- Description: 文档规定 `requestHash = sha256(method + path + raw body bytes)`，且明确「含 multipart 上传」。但 multipart/form-data 的 boundary 由客户端每次随机生成，同一文件重传时 raw body bytes 几乎必然不同。结果是 harness 按文档第 7 节的指引「同一 Idempotency-Key 重试上传」时，合法重试会被判为 409 `Idempotency-Key reused with a different request body`——幂等在最需要它的路由（`create_raw_asset`，不可由 JSON 重建的副作用）上反而是坏的。
- Evidence: 文档「每个 agent 写请求（POST/PATCH under `/api/agent`，含 multipart 上传）」+ `requestHash` 定义；`POST /api/agent/raw-assets` 为 multipart（文档第 4 节工具合同）。现有 `app/api/raw-assets/route.ts` 以 `request.formData()` 解析，raw bytes 含随机 boundary。
- Suggestion: 对 multipart 路由改为规范化哈希：`sha256(method + path + 规范化字段)`，规范化 = file 字节内容的 hash + originalName + 其他标量字段（不含 boundary、不含 header 顺序）；JSON 路由可保留 raw body hash 或同样改为规范化 JSON（key 排序）。文档需写明两条路径各自的 hash 输入。
- Status: addressed
- Response: Idempotency 节改为两条 hash 路径：JSON 用递归 key 排序的 canonical JSON；multipart 用 file 内容 sha256 + originalName + mimeType + text 字段，明确不含 boundary / header 顺序。禁止对 multipart 哈希 raw body。

### Issue 3: Promote 存在 read-then-write 竞态，可产生重复 Question 或 500
- Severity: major
- Section: Hard Constraints → Promote（human-only）
- Description: 文档规定前置检查「Draft 存在且 status ∈ {DRAFT, NEEDS_REVIEW}」，然后「同一事务内」建 Question / Version / ReviewRecord / 更新 draft。普通事务内先读后写挡不住并发：两个并发 promote 都读到 DRAFT、都通过校验，然后都会 `Question.create`。兜底只剩 `promotedQuestionId @unique`——第二个请求以 P2002 崩溃成 500，而不是文档承诺的 409 `Draft is not promotable`，且第一个请求已产生的 Question 与第二个请求事务内的写入时序也未定义。「promote 天然幂等」的结论只在串行请求下成立。
- Evidence: 文档 Promote 节前进步骤与「已 PROMOTED 或 REJECTED 的草稿再 promote → 409」；`prisma/schema.prisma` 现有 `QuestionDraft` 无版本/锁字段；additive `promotedQuestionId String? @unique`。
- Suggestion: 把状态翻转写成条件更新并作为裁决点：事务内先 `UPDATE QuestionDraft SET status='PROMOTED' ... WHERE id=? AND status IN ('DRAFT','NEEDS_REVIEW')`（Prisma `updateMany`，检查 `count===1`，为 0 则 409），再插 Question 等行；或用 `SELECT ... FOR UPDATE`。同时明确 P2002 on `promotedQuestionId` 映射为 409 而非 500，作为第二道防线。补一条并发 promote 的集成测试要点。
- Status: addressed
- Response: Promote 改为同一事务内 `updateMany` 条件更新作为仲裁（`count===0` → 409 `Draft is not promotable`），随后插 Question / Version / ReviewRecord。`promotedQuestionId` 上 P2002 映射 409。校验失败不得翻转 status。测试表增加并发 promote 要点。

### Issue 4: IdempotencyRecord 的「查不到再执行再写入」是 check-then-act 竞态
- Severity: major
- Section: Hard Constraints → Idempotency-Key + request_id + AgentRun
- Description: 文档行为第 2 条是「查 unique (apiKeyId, key)：不存在则执行，写入 record」。两个并发相同请求会同时查不到、同时执行、同时插业务行，然后第二个在 record 插入处撞 `@@unique([apiKeyId, key])`——草稿/素材已重复创建。这恰好是文档自己点名的动机（「harness 重试会产生重复草稿」，Key Decision 10）在最常见并发形态下防不住。
- Evidence: 文档 Idempotency 行为步骤 2；`IdempotencyRecord` schema 的 `@@unique([apiKeyId, key])`；没有任何关于占位插入或冲突重读的句子。
- Suggestion: 改为约束驱动：先尝试插入「进行中」占位 record（或在事务内先插 record 再执行业务写），P2002 时重读已有 record 并回放其响应；或把「创建 record + 业务写」放同一事务、用唯一冲突触发重读。v1 也可以选择更简单的串行化：对 `(apiKeyId, key)` 用 advisory lock。文档需写明失败中的 record（执行到一半崩了）如何处理——建议加 `state: in_progress|completed` 或说明「执行失败不写 record，允许重试」。
- Status: addressed
- Response: 改为先插入 `state=in_progress` 占位；`P2002` 则重读并回放（hash 不同 409，仍 in_progress 则短轮询后 `Idempotency-Key in progress`）。业务失败删除 in_progress 行，不留 completed，允许同 key 重试。Schema 增加 `state` 字段。

### Issue 5: Migration 策略（一次性 init 含全部 additive 字段）与 PR Plan（PR-2/3/5 各自增量改 schema）互相矛盾
- Severity: major
- Section: Data Model → Migration 策略 vs PR Plan（PR-2、PR-3、PR-5、PR-7）
- Description: Migration 策略第 2-3 步说「把当前 schema.prisma 加上文 additive 字段」然后生成一份 `init_harness_first`。但 PR-2 只加 `difficulty`/`knowledgePointIds`/`tagIds`，PR-3 加 `promotedQuestionId`，PR-5 加 `IdempotencyRecord` 与 `AgentRun.apiKeyId/requestId`。工程师会无所适从：要么 PR-2 带一份只含部分字段的 init migration（之后 PR-3/5 再各来一份增量 migration——那 init 就不是「加上文 additive 字段」），要么另起一个 schema-only PR 先落全部字段（PR Plan 里没有这个 PR）。PR-7 的「若前面没提交就补上」又让基线落点进一步漂移。
- Evidence: 文档 Migration 策略步骤 2-3；PR-2/PR-3/PR-5 各自的 schema 改动条目；PR-7 的条件句。
- Suggestion: 二选一并写死：(a) 新增 PR-0「schema + init_harness_first migration」，一次落全部 additive 字段，后续 PR 不再碰 schema；(b) 明确「每个碰 schema 的 PR 自带一份增量 migration，PR-2 的 init 只含当时所需字段」。推荐 (a)，与文档自己「migration 必须在第一次 additive schema 落地时引入」的强措辞最一致。
- Status: addressed
- Response: 采用 (a)。新增 PR-0 一次提交全部 additive 字段 + `init_harness_first`。PR-2/3/5 不再改 schema；PR-7 不再作为 migration 安全网（未合 PR-0 则阻塞，不代做 baseline）。

### Issue 6: Suggestion accept 的写入语义不完整：append 还是 replace、重复 accept、双 primary 均未定义
- Severity: major
- Section: Hard Constraints → Suggestion accept 写哪些字段
- Description: 字段表说了「写什么、写到哪里」，但没说写入语义：(1) accept 一条 KP suggestion 时，是替换 `QuestionKnowledgePoint` 现有全部行，还是追加？若问题已有 `primaryKnowledgePointId` 和一条 role=primary 的 join 行，accept 会「更新 primaryKnowledgePointId」但旧 join 行的 `role=primary` 不动——结果两条 primary，与 `createQuestionWithCandidate` 的「index 0 = primary」约定冲突。(2) `QuestionKnowledgePoint` 主键是 `@@id([questionId, knowledgePointId])`，对同一 suggestion 重复 accept（accept→reopen→accept，或两条内容重叠的 suggestion 都被 accept）会 P2002 → 500。(3) 整个 accept（改 Question + 写 join + 改 difficulty + 写 ReviewRecord）是否一个事务，文档未说；中途失败会留下「suggestion 没 accepted 但 metadata 已写」的半成品。
- Evidence: 文档 accept 字段表（「第一条 role=primary，并更新 Question.primaryKnowledgePointId」）；`prisma/schema.prisma` `QuestionKnowledgePoint` 的 `@@id` 与 `role @default("secondary")`；`lib/domain/question-repository.ts:151-156` 的 primary 约定。
- Suggestion: 写明：accept = 在同一事务内「删除该 question/draft 上同类 metadata 的现有写入 → 按 payload 重建（第一条 primary）→ 更新 suggestion status + ReviewRecord」，join 写入用 upsert 或先 deleteMany；重复 accept 幂等返回 200；两个并发 accept 以后提交者覆盖（last-write-wins）并各留 ReviewRecord。
- Status: addressed
- Response: Accept 定为同一事务内 replace-of-kind：`deleteMany` 后按 payload 重建（index 0 = primary），再写 status + ReviewRecord。重复 accept 幂等 200。并发 last-write-wins，各留 ReviewRecord。缺 id 或未知 FK → 422 且回滚。

### Issue 7: 幂等规则字面化会波及只读 POST `search_questions`，破坏既有契约
- Severity: minor
- Section: Hard Constraints → Idempotency-Key（「每个 agent 写请求（POST/PATCH under /api/agent）」）vs Agent Tool API Surface
- Description: 「POST/PATCH under /api/agent」按字面包含 `POST /api/agent/search-questions`——但它是只读操作，且文档同时承诺「现有两条只读路由在 v1 继续只返回原 shape」「以免与现有测试契约冲突」。若实现者给 search 也强制 Idempotency-Key，现有 `tests/unit/agent-routes.test.ts` 契约和已部署 harness 立刻 400。`check_question_quality` 虽确定性无副作用，但会写 AgentRun，要求 key 是合理的——所以正确分界是「是否产生业务写入」，不是 HTTP 方法。
- Evidence: 文档 Idempotency 表（「缺省 → 400」）与「现有两条只读路由继续只返回原 shape」并存；`app/api/agent/search-questions/route.ts` 现存且无 Idempotency-Key 概念。
- Suggestion: 把规则改写为「所有产生业务写入的 agent 路由必须 Idempotency-Key；`search_questions`、`get_question`、`list_*` 等只读路由（无论 GET/POST）不要求」。在工具总表加一列「Idempotency required: yes/no」消歧。
- Status: addressed
- Response: 分界改为「是否业务写入」而非 HTTP 方法。工具总表增加 Idempotency 列：search/get/list 为 no；create/update/suggestions/quality-check/sets/export 为 yes。现有 search 契约不被破坏。

### Issue 8: `get_question_draft` 的「任选一 scope」与 `hasRequiredScopes` 的全命中语义冲突
- Severity: minor
- Section: Agent Tool API Surface → 工具总表 / Hard Constraints → Scope catalog
- Description: 工具总表给 `get_question_draft` 的 scope 是「`drafts:create` 或 `drafts:update` 任一」，但文档同时规定 `hasRequiredScopes` 保持「必须全部命中」且禁止通配。any-of 语义在现有函数上无法表达，需要引入第二种判定模式，文档没有指出这一点；实现者很可能写成全命中（导致只有单一 scope 的 key 读不了自己建的草稿）或临时加一个没人审过的 anyOf helper。
- Evidence: 文档工具总表 `get_question_draft` 行；`lib/auth/agent-auth.ts:11-18` 的 `hasRequiredScopes`（`required.every(...)`）。
- Suggestion: 要么给该路由定一个单一 scope（如复用 `questions:read`，或新增 `drafts:read` 并加入默认列表），要么在 Scope catalog 明确引入 `hasAnyScope` 原语及其适用清单。前者更简单。
- Status: addressed
- Response: 新增默认 scope `drafts:read`；`get_question_draft` 只要求这一项。明确禁止 `hasAnyScope` / `*`，继续只用 `hasRequiredScopes` 全命中。

### Issue 9: 状态机允许 human 把草稿置 REJECTED，但共享 draft schema 的 status enum 不含 REJECTED，human 无路可走
- Severity: minor
- Section: Hard Constraints → 状态机 / Draft JSON 契约 / Human UI Changes
- Description: 状态机有 `DRAFT/NEEDS_REVIEW → REJECTED: human only`；但 `questionDraftInputSchema.status` 只有 `["DRAFT", "NEEDS_REVIEW"]`，且文档说工作台 Save 的 human `PATCH /api/drafts/:id`「与 agent update 共用 domain」。共用 domain + 该 enum = human 也无法把草稿 REJECTED——该状态在 v1 不可达，文档没有指出这是有意裁剪还是漏洞。同理状态机里 human 的 `NEEDS_REVIEW → DRAFT`（send back）是可用的，但 UI 节完全没提这个入口。
- Evidence: 文档状态机表（`Draft_* → Draft_REJECTED: human only`）；Draft JSON 契约的 `status: z.enum(["DRAFT", "NEEDS_REVIEW"])`；Human UI Changes 只列 Save / Promote / Accept / Reject suggestion。
- Suggestion: 二选一写明：(a) v1 不实现 REJECTED，把状态机标注为「schema 已支持、v1 无入口」；或 (b) human PATCH 允许 `REJECTED`（domain 层按 actor 分流：agent 只能 DRAFT↔NEEDS_REVIEW，human 可加 REJECTED/DRAFT），并在草稿工作台加 Reject 按钮。推荐 (b) 且 domain 函数显式接收 actor 参数。
- Status: addressed
- Response: 采用 (b)。`updateQuestionDraft({ actor, input })`：agent 仅 DRAFT↔NEEDS_REVIEW；human 可 REJECTED 与 send back。工作台增加 Reject / Send back。Agent 送 REJECTED → 400/409。

### Issue 10: OQ-2 讨论 `get_question` 是否收答案，却漏了 `export_question_set` 这条同等级泄露通道
- Severity: minor
- Section: Open Questions → OQ-2 / 工具总表 `export_question_set`
- Description: OQ-2 权衡 `get_question` 是否继续返回 `answerJson`，威胁模型也列了这条。但 agent 默认 scope 含 `exports:create`，而 export body 默认 `teacher: true`——现有 `renderQuestionToMarkdown/Latex` 在 teacher 模式下直接拼出答案与解析。也就是说即使 OQ-2 选了 2b/2c 把 get 收成预览 DTO，任何持默认 key 的 agent 仍可通过「建题组 → 导出」拿到全量答案。威胁模型把该威胁评为 Low–Med 的部分前提（「小团队可接受」）成立，但文档应指出两条通道等价，否则 OQ-2 的决策是无效的。
- Evidence: `lib/renderer/export-question-set.ts:96-141`（teacher 默认 true 时输出 `答案：` / `解析：`）；`app/api/question-sets/[id]/export/route.ts` 的 `parseExportBody`（`teacher: candidate.teacher !== false`）；文档 scope 表 `exports:create` 默认授予。
- Suggestion: 在 OQ-2 中并列说明 export 通道；若选 2b/2c，则 agent export 强制 `teacher: false`（服务端忽略请求值）或把 `exports:create` 移出默认 scope。v1 维持现状也可以，但要把「答案经 export 可得」写进威胁模型。
- Status: addressed
- Response: 未改 OQ-2a（v1 仍返回 `answerJson`）。OQ-2 与威胁模型并列写明 `export_question_set` 默认 `teacher: true` 是同等级答案通道；若将来选 2b/2c 必须同时收紧 export，否则决策无效。

### Issue 11: 文档称 Suggestion payload「对齐现有 mock 形状」，但 mock 的 `MetadataSuggestion` 没有 `id` 和 `tag_ids`
- Severity: minor
- Section: Hard Constraints → Suggestion accept 写哪些字段
- Description: 文档的 payload 示例含 `knowledge_points[].id` 与 `tag_ids[]`，并声称对齐 `lib/workers/mock-classification-agent.ts` 的 `MetadataSuggestion`。实际该类型只有 `value/confidence/reason` 与 `difficulty/risks`，没有 `id`、没有 `tag_ids`。「对齐」说法会误导实现者以为现有 mock 产出可直接流入 accept 写入路径；实际上 mock 产出的 `value` 是自由文本，按文档规则（id 才是权威）根本无法 accept。这不影响设计正确性，但影响 PR-8（mock 保留为夹具）与 PR-4 的衔接描述。
- Evidence: `lib/workers/mock-classification-agent.ts:1-13`（`MetadataSuggestion` 定义）；文档 Suggestion payload 示例与「Payload 对齐现有 mock 形状」句。
- Suggestion: 把措辞改为「在 mock 形状上扩展：新增必填 `id` 与可选 `tag_ids`；mock 夹具的自由文本 `value` 不参与 accept 写入」；若保留 mock classify 路由（OQ-3b），说明其产出的 suggestion 因缺 id 只能被 reject/人工参考，不能被 accept 写入。
- Status: addressed
- Response: 改为「mock 形状是子集」。Accept 要求 `knowledge_points[].id`；缺 id → 422。Mock classify 产出不能原样 accept，只能 reject 或人工参考。UI 对缺 id 的 Accept 禁用或展示 422。

### Issue 12: Draft 的 `sourceRawAssetId` 存在性检查与错误映射未规定
- Severity: minor
- Section: Agent Tool API Surface → Draft JSON 契约
- Description: 文档规定 `knowledgePointIds`/`tagIds`「提供了 id 则立刻做存在性检查，未知 → 422」，但没提 `sourceRawAssetId`。`QuestionDraft.sourceRawAssetId` 在 Prisma 里是 FK relation，拿不存在的 id 建草稿会撞 P2003 → 未捕获则 500。要么主动查 RawAsset 并返回 422 `Raw asset not found`（错误表里已有该字符串），要么捕获 FK 错误映射——文档应选一种写明。
- Evidence: 文档 Draft JSON 契约「提供了 id 则立刻做存在性检查」仅指 KP/tag；`prisma/schema.prisma:150`（`sourceRawAsset RawAsset? @relation(...)`）；文档错误表已含 404 `Raw asset not found` 但无 422 场景说明。
- Suggestion: 在 Draft JSON 契约补一句：`sourceRawAssetId` 同样做存在性检查，未知 → 422 `Raw asset not found`；promote 时若 draft 引用的 RawAsset 已不存在（被删/归档策略变化）的行为也需一句（建议：归档不影响 promote，FK 在则放行）。
- Status: addressed
- Response: create/update draft 对 `sourceRawAssetId` 做存在性检查，未知 → 422 `Raw asset not found`（不靠 P2003 变 500）。Promote 时行在则放行（含 ARCHIVED）；行不在 → 同一 422。v1 无删除 RawAsset 路由。

### Issue 13: `POST /api/auth/editor-session` 无暴力破解防护；cookie 寿命推迟到 OQ 但 fail-closed 边界需一句
- Severity: minor
- Section: Auth → Human auth 选择：方案 a
- Description: 共享 secret 方案本身对「单操作者小团队」是合理权衡，恒定时间比较也写了。但两个缺口没提：(1) 解锁端点没有速率限制/失败计数，公网部署时 secret 可在线爆破——16 字符随机 secret 熵足够，但「≥16 字符」若由人手工填写可能很弱，文档没要求生成方式；(2) cookie 无过期语义写在哪（OQ-1 才讨论会话级 vs 7 天），而 cookie 值是 secret 的确定性 HMAC、无 session 表——意味着无法吊销单个已发出的 cookie，只能轮换 secret 全部失效，这一点应写进威胁模型而不是留给实现者发现。
- Evidence: 文档方案 a 实现列表（无 rate limit、无吊销语义）；「v1 直接把 secret 的 hmac 当 cookie 值即可，不建 session 表」。
- Suggestion: 补三句：secret 必须由 CSPRNG 生成（如 `openssl rand -hex 32`）而非人工想；解锁端点加最简限流（如每 IP 每分钟 N 次失败即 429）或至少记入威胁模型的接受风险；写明「cookie 不可单独吊销，轮换 `EDITOR_SESSION_SECRET` 即全员重登」。
- Status: addressed
- Response: Secret 必须 `openssl rand -hex 32`。解锁失败每 IP 每分钟 5 次 → 429 `Too many unlock attempts`。Cookie 为 secret 的 HMAC、无 session 表，不可单张吊销；轮换 secret = 全员重登。已写入实现列表与威胁模型。OQ-1 将会话级 cookie 与测试 header 定为工程默认。

### Issue 14: 回滚节称 `DEPRECATED`「若已引入」——该 enum 值已存在于 schema
- Severity: minor
- Section: Rollout Plan → 回滚
- Description: 「Question 可用 `DEPRECATED`（若已引入）或手工 SQL」暗示 DEPRECATED 可能需要后续引入；实际上 `QuestionStatus` enum 已有 `DEPRECATED`（`prisma/schema.prisma:38-42`）。这是小的事实误差，但与文档其他部分（状态机里 `Question_REVIEWED → Question_DEPRECATED: human only`）自洽性冲突，容易让实现者误以为还要先加 enum 值。
- Evidence: `prisma/schema.prisma:41`；文档状态机 vs Rollout Plan 回滚句。
- Suggestion: 改为「Question 可用现有 `DEPRECATED` 状态或手工 SQL；v1 不提供 agent 删除，也不提供 deprecate 的 UI/路由（状态机仅预留）」。顺带说明 v1 是否有人工 deprecate 路由——目前文档只说「human only」但没在任何 API 表里给入口。
- Status: addressed
- Response: 回滚节改为使用**现有** `QuestionStatus.DEPRECATED` 手工 SQL。明确 v1 无 deprecate/publish UI 或路由，enum 值状态预留。Key Decision 18 与状态机表同步。

### Issue 15: RawAsset 的 `ARCHIVED` 状态转换在 v1 没有任何路由入口
- Severity: nit
- Section: Hard Constraints → 状态机（RawAsset 部分）/ API / Interface Changes
- Description: 状态机给了三条 `* → ARCHIVED: human only`，但 Human 侧 API 表和 Agent 工具总表里都没有 archive 路由。与 Issue 9 同类：状态机画了、schema 支持、v1 无入口。不影响安全，但文档没声明这是有意留空。
- Evidence: 文档状态机 RawAsset 段；「API / Interface Changes（Human 侧补全）」表无 raw-assets 状态变更路由。
- Suggestion: 标注「v1 无 archive 入口，状态预留」；或把 `POST /api/raw-assets/:id/archive`（human only）加入 v1 范围。
- Status: addressed
- Response: 采用「v1 无 archive 入口，状态预留」。未把 archive 路由加入 v1。状态机图后加说明：ARCHIVED/DEPRECATED/PUBLISHED 仅 schema 预留。

### Issue 16: Human 路由拒 agent 的 403 文案有两个版本，且与错误表不完全对齐
- Severity: nit
- Section: Auth → 方案 a 实现 / Agent Tool API Surface → 稳定 error 字符串
- Description: 方案 a 写「`Agent cannot publish questions` / `Agent key not accepted on human routes`」两个字符串并存，错误表里只收了前者且标注「human 路由拒 agent」。前者语义只对 publish 成立——对 `PATCH /api/suggestions/:id`、`POST /api/raw-assets` 等路由用同一文案会文不对题。文档未规定按路由选哪个。
- Evidence: 文档方案 a 最后一项 vs 错误字符串表 403 行。
- Suggestion: 统一为 `Agent key not accepted on human routes`（publish 路由可保留特化文案但需在表中注明两个都是稳定契约），并把「错误字符串是测试锁定的契约」原则应用到这两个值。
- Status: addressed
- Response: 默认 403 统一为 `Agent key not accepted on human routes`。`POST /api/questions` 与 `POST /api/drafts/:id/promote` 保留特化 `Agent cannot publish questions`。错误表两条都列为测试锁定契约。

### Issue 17: `IdempotencyRecord` 无保留策略，`responseBody` 可能吞掉整份导出内容
- Severity: nit
- Section: Data Model → IdempotencyRecord / Observability
- Description: 表只有 `@@index([createdAt])`，没有 TTL/清理策略；`responseBody Json` 对 `export_question_set` 会存整份 markdown/latex 文本（题组大时可观）。v1 量级下无所谓，但文档自己强调「不可含糊」的运维面应该有一句。
- Evidence: 文档 IdempotencyRecord 定义；`app/api/question-sets/[id]/export/route.ts` 响应含完整 `content`。
- Suggestion: 加一句运维注记：v1 不做清理，建议按 `createdAt` 定期归档/删除（如保留 90 天）；或对大响应只存摘要 + 业务主键。
- Status: addressed
- Response: Idempotency 节、数据模型与 Observability 增加：v1 无 cleaner，建议按 `createdAt` 保留 90 天；注明 export 的 `responseBody` 可能含整份 Markdown/LaTeX。

### Issue 18: Human 路径承诺恒定时间比较，agent dev key 比较却沿用非恒定时间的 `!==`
- Severity: nit
- Section: Auth → Agent keys / 方案 a
- Description: 方案 a 明确「恒定时间比较」，但同一文档的 `readAgentAuth` 扩展没提比较方式，而现有 `readDevAgentScopes` 用 `token !== configuredToken` 直接字符串比较（`lib/auth/agent-auth.ts:36`）。对一个 dev-only 共享 key 这不是现实威胁，但同一文档两种口径不一致，顺手统一成本为零。
- Evidence: `lib/auth/agent-auth.ts:36`；文档方案 a「恒定时间比较成功后设置 Set-Cookie」。
- Suggestion: 在 Agent keys 节补一句「dev key 与 ApiKey hash 比较均使用 `crypto.timingSafeEqual`」；或显式声明 dev key 不做恒定时间比较是可接受风险。
- Status: addressed
- Response: Agent `AGENT_API_KEY_DEV` 与 `ApiKey.keyHash`、以及 editor secret 一律先 sha256 再 `crypto.timingSafeEqual`。明确禁止 `token !== configuredToken`。Key Decision 5 同步。

## PR Plan review

顺序与切分总体正确，符合「先关安全洞、skill 在工具之后、MCP/模型不进 v1」的要求：

- **PR-1（关洞）放第一个是对的**，且「human POST 暂时仍走 `createQuestion` + editor session、PR-3 再切 promote」的过渡设计务实，避免 PR-1 阻塞在 promote 实现上。但必须配合 Issue 1：关洞清单要全量枚举 `app/api/**`，不能只管表里列出的——漏掉 `GET /api/questions/[id]` 会让 PR-1 白做一半。
- **PR-2 要求 draft create 本 PR 就幂等**是正确的提前量（否则 harness 重试立刻产重复草稿），但这把 Issue 2/4 的幂等实现推到了 PR-2，而 `IdempotencyRecord` 表按文档又归 PR-5——要么 PR-2 自带该表 migration（与 Issue 5 一并解决），要么接受 PR-2 用内存/简化实现（不推荐）。
- **PR-3 依赖 PR-2、PR-4 依赖 PR-3** 合理（accept 写 Question 需要 promote 产物）。PR-4 与 promote 联动（「promote 时把 draft suggestions 的 questionId 补上」）是隐藏耦合，建议在 PR-3 描述里就点明 promote 要回填 suggestion.questionId，否则 PR-3 合并时该行为无人认领。
- **PR-5 兜底收集剩余 wrapper + idempotency 设施**：范围偏大（5 个新路由 + 上传限制 + IdempotencyRecord + AgentRun 字段），可考虑把 idempotency 设施与表单独提前，但不阻塞。
- **PR-6 skill 在工具之后、PR-8 mock 降级放最后**，顺序正确；PR-7 的「migration 若前面没做这里必须补」是安全网但不应成为默认路径（见 Issue 5，建议改为 PR-0）。
- 每个 PR 都列了文件与测试落点，颗粒度够工程师直接开工；唯一缺的是 PR-0（schema + init migration）和 PR-1 的全量路由枚举验收。

## Fact-check vs repo

抽查方式：通读设计文档全文（1254 行，与 `/tmp/grok-tdcasual/grok-design-doc-1d67282a.md` diff 确认完全相同），逐文件核对下列路径。结论：**抽查通过**，文档对现状的陈述基本属实；不一致处仅 Issue 11（mock payload 形状措辞）、Issue 14（DEPRECATED 已存在）两处轻微事实误差。

已核对文件：

- `prisma/schema.prisma` — 模型与 enum 全对齐；`QuestionDraft` 确无 difficulty/KP/tags/promotedQuestionId；`AgentRun` 确无 apiKeyId/requestId；无 `IdempotencyRecord`。
- `lib/auth/agent-auth.ts` — `devAgentScopes` 缺 `drafts:update` 属实；仅环境变量明文比对属实。
- `lib/domain/question-repository.ts` — `createQuestion` 经 `buildPersistedQuestionContract` 写死 `status:"REVIEWED"` 属实；`buildManualPublicQuestionId` 含 P2002 重试。
- `lib/domain/question-schema.ts` — `validatePublishableQuestion` 接受 Partial、中文错误串（`题干不能为空`/`答案必须匹配选项`/`必须确认知识点`）与文档引用一致。
- `lib/domain/suggestion-policy.ts` — `canSuggestionWriteDirectlyToQuestion` 确实只看 `actor === "human"`。
- `app/api/questions/route.ts` — POST 无认证属实；`mapQuestionApiError` 错误串一致。
- `app/api/agent/questions/[id]/route.ts`、`app/api/agent/search-questions/route.ts` — 仅这两条属实；get 返回含 answerJson 的注释属实；401 `Unauthorized` 契约属实。
- `app/api/suggestions/[id]/route.ts` + `tests/unit/suggestion-review-route.test.ts` — PATCH 不写 Question、测试断言 `question.update` 未调用，均属实。
- `app/api/raw-assets/route.ts` — 无认证、无大小/MIME 限制、空 `file.type` fallback 为 octet-stream 再被 `detectRawAssetKind` 标 TEXT，均属实。
- `app/api/questions/[id]/route.ts`、`app/api/search/questions/route.ts` — 无认证且未列入文档空洞清单（Issue 1）。
- `app/api/question-sets/[id]/export/route.ts` — 同步建 `ExportJob` 直接 `SUCCEEDED`、body `{format, teacher}` 均属实。
- `components/question/question-editor.tsx` — 纯本地 state demo 题属实。`components/draft/draft-review-workspace.tsx` — 读 DB（经 page.tsx 传入）、编辑纯本地、无 save/promote 属实。
- `lib/storage/storage-service.ts` — 拒绝绝对路径与 `..` 逃逸属实。
- `lib/renderer/render-markdown.tsx`、`lib/renderer/export-question-set.ts` — 图片 allowlist 与 LaTeX 黑名单内容与文档逐字一致。
- `lib/search/question-search.ts` — 规则 NL + `contains mode: "insensitive"`（ILIKE 等价）属实；search select 不含 answerJson 属实。
- `lib/workers/mock-classification-agent.ts`、`lib/domain/parse-raw-asset-workflow.ts` — mock 形状与「写 Suggestion 不改 Question」属实；mock 无 `id`/`tag_ids`（Issue 11）。
- `prisma/seed.ts` — 1 个 OWNER `owner@example.com`、4 知识点（含 slug `vt-area-displacement`）、4 tag，属实。
- `prisma.config.ts`、`package.json`、`docs/development.md` — Prisma 7 + adapter-pg + config datasource url、`db:migrate` 脚本、文档假设 `--name init` 均属实。
- 无 `prisma/migrations/`、无 `middleware.ts` — 属实。
- `.env.example` — 含 `AGENT_API_KEY_DEV`，无 `EDITOR_SESSION_SECRET`（待 PR-1 添加），属实。

## Residual risks after v1

以下不构成 v1 的阻塞项，但 v1 合并后依然存在，应进入 backlog：

- **共享秘密模型的天花板**：`EDITOR_SESSION_SECRET` 与 `AGENT_API_KEY_DEV` 都是「知道即身份」。无个人账号审计（promote 的 actorId 恒为 seed OWNER），无法回答「哪位老师确认的」。多用户化（方案 c）是真正解，v1 只是预留了 User.id 挂钩。
- **答案面始终对 agent 开放**：get_question 全量 DTO + export teacher 模式（Issue 10）。若题库内容未来有保密要求，需要 preview scope + export 强制去答案的改造。
- **无速率限制/配额**：agent 写路由除幂等外无任何配额；泄露的 key 可以高速灌草稿（内容仍进不了正式题，但可造成存储与审核噪音）。
- **本地文件存储单点**：`LOCAL_UPLOAD_DIR` 无备份/清理策略；`IdempotencyRecord`、`AgentRun`、`ReviewRecord` 均无 retention。
- **知识点树治理缺位**：v1 没有 KP/tag 的新建接口（agent 只能引用现有 id），树增长只能 SQL/seed——短期是特性（防止 agent 污染分类），中期需要 human 侧管理入口。
- **Promote 后的修订闭环未定义**（OQ-6）：正式题内容错了只能 DEPRECATED + 重来或手工 SQL；QuestionVersion v2 语义待定。
- **CSRF 依赖 SameSite=Lax**：方案 a 未讨论 CSRF；Lax 在现代浏览器对跨站 POST 基本够用，但若未来加 GET 触发副作用或非浏览器客户端需重新评估。
- **E2E 不进默认 check**：`npm run check` 不含 Playwright，promote 全链路只靠单测 mock prisma，真实事务/并发行为（Issue 3/4 的修复）需要集成测试设施跟进。

---

## Revision Summary

- 2026-09-06：Kimi 初审，Verdict = Approve with issues（18 条 open）。
- 2026-09-06：设计文档按全部 18 条修订。Issues 1–18 均为 **addressed**（无 wontfix / needs-user-input）。主要落地：全量 human API 空洞枚举；multipart canonical hash；promote 条件 UPDATE + P2002→409；幂等先插 `in_progress`；PR-0 一次 schema/migration；suggestion replace-of-kind；Idempotency 列；`drafts:read`；human REJECTED；OQ-2 并列 export 通道且不改 v1 暂定；mock 子集不能 accept；`sourceRawAssetId` 422；CSPRNG + 解锁限流 + cookie 不可单张吊销；DEPRECATED/ARCHIVED 状态预留；403 文案分流；90 天幂等保留建议；`timingSafeEqual`。两份设计文档保持 identical。
