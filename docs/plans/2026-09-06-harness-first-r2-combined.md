# Combined Round 2 Review (Grok + Kimi)

| 字段 | 值 |
| --- | --- |
| Auditors | Grok + Kimi Code CLI |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md |
| Round | 2 combined |
| Verdict | Needs revision |

上一轮 18 条均已真正修住。本轮交叉审计新问题如下。Round 2 处理结果：16/16 addressed。

## Issues

### Issue 1: Key Decision 3 与 PR-1 过渡期互相否定「唯一插入路径」
- Severity: major
- Section: Key Decisions #3 / PR-1 / OQ-4
- Description: KD-3 写「正式 Question 只由 `promoteDraftToQuestion` 插入」。PR-1 明确 human `POST /api/questions` 仍调用 `createQuestion`（无 Draft、无 QuestionVersion、无 ReviewRecord），直到 PR-3 才切。OQ-4 仍开放。实现者按 KD-3 会在 PR-1 拆掉入库；按 PR-1 则 KD-3 为假。
- Evidence: KD-3；PR-1「仍调用 createQuestion」；`buildPersistedQuestionContract` 写死 REVIEWED。
- Suggestion: KD-3 改成带阶段：PR-3 起唯一插入路径是 promote；PR-1 过渡允许 session 下 createQuestion。PR-1 注明过渡期题目无 version 历史，已知接受。OQ-4 选定暂定项写入正文（推荐 4a：PR-3 把 POST 收成 draft+promote 包装）。
- Status: addressed
- Response: KD-3 改为分阶段。PR-1 过渡 human POST 仍走 `createQuestion`（无 Draft/Version/ReviewRecord，已知接受）。OQ-4a 锁定为 PR-3 终态：该 POST 收成 draft+promote 包装。Goals / 空洞表 / PR-1 / PR-3 同步。

### Issue 2: 题图无法按文档预览：allowlist 指向不存在的读路由，skill 禁止 data URL
- Severity: major
- Section: 渲染安全 / Skill §6 / Security / create_raw_asset
- Description: `isSafeImageSrc` 只放行 `/assets/`、`/uploads/`、`/api/assets/`。仓库无这些 GET，next.config 为空，文档禁止无鉴权暴露 uploads。Skill 禁止 data URL。图像题在校对台看不见图。
- Evidence: `lib/renderer/render-markdown.tsx`；Security「今天没有 uploads 的 HTTP 读路由」；Skill §6。
- Suggestion: 选定 (a)：v1 增加 human session 保护的 `GET /api/raw-assets/:id/file`（agent 可用 `drafts:read` 或 `questions:read` 读已挂到 draft/question 的图）。allowlist 增加 `/api/raw-assets/` 前缀。禁止路径穿越。该路由列入 PR-5 与 `app/api/**` 枚举。左栏原图也走同一 GET。
- Status: addressed
- Response: 采用 (a)。Human `GET /api/raw-assets/:id/file` 放在 PR-2（校对台预览需要）；agent 对应路由放 PR-5，按 linkage 选 `questions:read` 或 `drafts:read`（不是 hasAnyScope）。allowlist 增加 `/api/raw-assets/`。空洞表、human API 表、skill 同步。

### Issue 3: Editor cookie 的 `HMAC-SHA256(secret)` 未定义密钥、消息和编码
- Severity: major
- Section: Auth → Human auth 方案 a
- Description: HMAC-SHA256 需要 key 与 message。文档只写 `HMAC-SHA256(secret)`，实现会分叉（SHA256、HMAC(secret,secret)、hex vs base64）。
- Evidence: Auth cookie 行。
- Suggestion: 写死：`cookie = hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message="physhub_editor.v1"))`。校验 `timingSafeEqual`。测试 header 只接受同一 cookie 值，不接受明文 secret。
- Status: addressed
- Response: Cookie 公式写死为 `hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message="physhub_editor.v1"))`。校验 `timingSafeEqual`。测试 header 只接受该 HMAC（Issue 8 一并限制 non-prod）。

### Issue 4: Agent 能否 `NEEDS_REVIEW → DRAFT`：状态机与 Draft 契约矛盾
- Severity: minor
- Section: 状态机 / Draft JSON 契约
- Description: 状态机 human send back only；契约写 agent `DRAFT ↔ NEEDS_REVIEW` 双向。
- Evidence: mermaid `human send back`；Draft 契约双向箭头。
- Suggestion: send back 定为 human-only。契约改为 agent 只能 `DRAFT → NEEDS_REVIEW`（单向）。
- Status: addressed
- Response: Agent 仅允许 `DRAFT → NEEDS_REVIEW`。反向 send back 为 human-only。Agent zod `status` 只含 `NEEDS_REVIEW`；非法枚举 → 400 `Invalid draft status`。状态机表与 mermaid 对齐。

### Issue 5: Promote 内容校验在事务外，仲裁只挡 status
- Severity: minor
- Section: Promote
- Description: 校验可在事务外；并发 PATCH 可在校验后改内容，Question 用旧快照或脏数据。
- Evidence: 「可在事务外预读」；updateMany WHERE 只有 status。
- Suggestion: 事务内仲裁成功后重读 draft，以重读内容跑 `validatePublishableQuestion` 再建 Question；失败整体回滚。
- Status: addressed
- Response: Promote 顺序改为：条件 `updateMany` 仲裁 → 事务内重读 draft → 用重读内容校验 → 再建 Question。校验失败整体回滚。测试表增加「以重读为准」。

### Issue 6: 幂等 completed 更新未与业务写同事务，崩溃永久毒化 key
- Severity: minor
- Section: Idempotency
- Description: 业务写提交后、UPDATE completed 前崩溃 → key 永停 in_progress，重试 409。
- Evidence: 幂等步骤 3 无「同事务」；promote 节有 `$transaction` 而幂等节没有。
- Suggestion: 占位可在事务外先插；业务写 + AgentRun + completed 更新同一事务。stale `in_progress` 超过 2 分钟视为失败，允许删除后重试。
- Status: addressed
- Response: 占位可在事务外插入；业务写 + AgentRun + `completed` 同一 `$transaction`。`in_progress` 且 `createdAt` 超过 2 分钟可条件删除后重试。KD-10 同步。

### Issue 7: `Draft is not updatable` 未进错误表，且「400 或 409」不定
- Severity: minor
- Section: 稳定 error 字符串 / Draft 契约
- Description: 字符串不在错误表；zod 非法与状态冲突混在一个码。
- Suggestion: body status 超出 agent 枚举 → 400 `Invalid draft status`；已 PROMOTED/REJECTED → 409 `Draft is not updatable`。两条进错误表。
- Status: addressed
- Response: 拆分：非法/越权 status → 400 `Invalid draft status`；已 `PROMOTED`/`REJECTED` → 409 `Draft is not updatable`。两条进入稳定错误表。

### Issue 8: `X-Physhub-Editor-Session` 生产可用明文 secret，绕过解锁限流
- Severity: minor
- Section: Auth / OQ-1
- Description: header 接受 secret 或 HMAC，每条 human 路由都是无限速比对。
- Suggestion: 仅 `NODE_ENV !== "production"` 读取该 header；值必须是 cookie 同款 HMAC，不接受明文 secret。
- Status: addressed
- Response: `X-Physhub-Editor-Session` 仅 non-production 且 cookie 缺失时读取；只接受 hex HMAC，不接受明文 secret。生产完全忽略该 header。明文只走解锁端点以便限流生效。

### Issue 9: 同一错误串跨 404/422
- Severity: minor
- Section: 稳定 error 字符串
- Description: `Raw asset not found` 与 `Question not found` 同时出现在 404 和 422。
- Suggestion: 规则写死：id 在 path → 404；id 在 body 被引用 → 422。与现有 question-set 行为一致。
- Status: addressed
- Response: 写死：path 上的资源 id → 404；body 引用的外键 → 422。同一字符串可出现在两个码，由位置决定。`GET .../file` 的 `:id` 是 404；draft body 的 `sourceRawAssetId` 是 422。

### Issue 10: `submit_suggestions` 同时给 draftId 与 questionId 未定义
- Severity: minor
- Section: submit_suggestions
- Description: 「之一」未定义两者都给、或 draft 已 PROMOTED 只给 draftId。
- Suggestion: XOR，两个都给 → 400 `Provide exactly one of draftId or questionId`。仅 draftId 且已 PROMOTED → 自动挂 `promotedQuestionId`（若有）否则 409 `Draft is not updatable`。
- Status: addressed
- Response: `draftId`/`questionId` XOR；两个都给或都不给 → 400。仅 draftId 且已 PROMOTED 且有 `promotedQuestionId` → 自动挂到该 Question；否则 409 `Draft is not updatable`。

### Issue 11: 状态机 RawAsset PROCESSING/PARSED 与 mock parse 代码不一致
- Severity: minor
- Section: 状态机 / parse-raw-asset-workflow
- Description: 图有 PROCESSING/PARSED；`parseRawAssetWithClient` 不更新 RawAsset.status。
- Suggestion: OQ-3b 若保留 parse：成功 PARSED、失败 FAILED、开始 PROCESSING。写进 PR-8。
- Status: addressed
- Response: 状态机表与 PR-8 写明：若保留 parse HTTP，必须更新 `RawAsset.status`（PROCESSING → PARSED/FAILED）。今日 `parseRawAssetWithClient` 不写该字段，本缺口由 PR-8 修。

### Issue 12: v1 只产生 REVIEWED，搜索示例仍强调 PUBLISHED
- Severity: minor
- Section: search 示例 / Skill
- Description: 无 publish 路由；只传 PUBLISHED 会空。
- Suggestion: Skill 与 search 合同：v1 可检索官方状态是 REVIEWED；示例 constraints 以 REVIEWED 为主。
- Status: addressed
- Response: Search 示例改为 `status: ["REVIEWED"]`。未传 status 时 agent 与 human 均默认 `REVIEWED`。Skill 写明不要只搜 `PUBLISHED`。`PUBLISHED` 仍是合法约束，留给未来入口。

### Issue 13: 复用 `buildPersistedQuestionContract` 会丢 sourceRawAssetId 与 tags
- Severity: minor
- Section: Promote / createQuestion
- Description: helper Pick 不含 sourceRawAssetId，createQuestion 不建 QuestionTag。Promote 步骤 2 却要这两项。
- Evidence: `lib/domain/question-repository.ts:30-40, 147-157`
- Suggestion: 写明 promote 扩展 helper：补 `sourceRawAssetId` 与 tags join，不要照抄 Pick 列表。
- Status: addressed
- Response: Promote 明确禁止只 spread `buildPersistedQuestionContract`。必须另行写 `sourceRawAssetId` 与 `QuestionTag`。PR-3 描述与测试覆盖这两项。

### Issue 14: QuestionVersion 的 createdBy vs createdById
- Severity: nit
- Section: Promote 步骤 3
- Suggestion: 填 `createdById: OWNER.id`，不要写无关系的 `createdBy` 字符串。
- Status: addressed
- Response: `QuestionVersion` 只填 `createdById: OWNER.id`。遗留字符串字段 `createdBy` 保持 null。

### Issue 15: Skill 未要求保存 draft.id
- Severity: nit
- Section: Skill Package
- Suggestion: Skill 加「必须保存 201 的 draft.id；v1 无 list-drafts」。
- Status: addressed
- Response: Skill 新增小节「Persist `draft.id`」：201 必须记下 id；v1 无 agent list-drafts。PR-6 描述同步。

### Issue 16: 解锁限流每 IP 未定义反代头
- Severity: nit
- Section: Auth 限流
- Suggestion: 默认用连接 IP，不信任 X-Forwarded-For，除非显式 `TRUST_PROXY=true`。
- Status: addressed
- Response: 解锁限流默认用 TCP 连接 IP。忽略 `X-Forwarded-For` / `X-Real-IP`，除非显式 `TRUST_PROXY=true`。`.env.example` 与 PR-1 同步。

---

## Revision Summary

- 2026-09-06 Round 2 combined（Grok + Kimi）：16 条 open 全部 **addressed**。设计文档同步：KD-3 分阶段 + OQ-4a 锁定；鉴权文件 GET + allowlist；HMAC cookie 公式；agent status 单向；promote 事务内重读；幂等同事务 + 2 min 回收；400 vs 409 status；测试 header 仅 non-prod HMAC；path 404 / body 422；suggestion XOR；mock parse 写 RawAsset.status；search 默认 REVIEWED；promote 扩展 helper；Version 只写 createdById；skill 保存 draft.id；限流不信 X-Forwarded-For。两份设计文档保持 identical。
