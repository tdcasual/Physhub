# Grok Re-audit Round 2: Physhub Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Grok (independent, post-revision) |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md |
| Round | 2 |
| Verdict | Approve with issues |

## Executive Summary

修订稿把上一轮 Kimi 的 18 条实现级漏洞基本写死了（空洞全量枚举、multipart canonical hash、promote 条件 UPDATE、幂等先插占位、PR-0、accept replace-of-kind）。方向仍可落地。本轮新发现的阻塞不在「要不要 harness-first」，而在三处实现者会写分叉的缺口：Key Decision 3 宣称唯一插入路径是 promote，PR-1 却仍走 `createQuestion`；HMAC cookie 算法未定义密钥/消息/编码；题图在 v1 无法按文档预览（allowlist 指向不存在的读路由，skill 又禁止 data URL）。

## Previous issues verification

上一轮 Issue 1–18 在修订稿中的状态（Grok 核对，非复读 Response）：

1. auth 空洞全量枚举 — fixed（表含 GET `[id]` 与 search；验收原则写了 `app/api/**`）
2. multipart requestHash — fixed
3. promote 竞态 — fixed（`updateMany` 仲裁 + P2002→409）
4. 幂等 check-then-act — fixed（先插 in_progress）
5. migration vs PR Plan — fixed（PR-0）
6. suggestion accept 语义 — fixed（replace-of-kind）
7. search 被幂等波及 — fixed
8. get_question_draft any-of — fixed（`drafts:read`）
9. REJECTED 不可达 — fixed
10. export 答案通道 — fixed（威胁模型并列）
11. mock payload 形状 — fixed
12. sourceRawAssetId — fixed
13. 解锁爆破/吊销 — fixed
14. DEPRECATED 已存在 — fixed
15. ARCHIVED 无入口 — fixed
16. 403 文案 — fixed
17. Idempotency 保留 — fixed
18. timingSafeEqual — fixed（agent 节已写 sha256 再比较）

## What is solid

- 机器写路径收敛到 `/api/agent/*`、human/agent 认证类不可互换，与当前裸奔 API 的落差写清楚。
- 状态机与 Prisma enum 对齐，并标明 v1 不交付的入口。
- 幂等与 promote 的并发方案现在是约束驱动，可测。
- Skill 仍是手册；安全测试不读 `skills/`。
- PR 顺序正确：schema → 关洞 → draft → promote → suggestion → wrappers → skill。

## Issues

### Issue 1: Key Decision 3 与 PR-1 过渡期互相否定「唯一插入路径」
- Severity: major
- Section: Key Decisions #3 / PR-1 / OQ-4
- Description: KD-3 写「正式 Question 只由 `promoteDraftToQuestion` 插入」。PR-1 明确 human `POST /api/questions` **仍调用 `createQuestion`**（无 Draft、无 QuestionVersion、无 ReviewRecord），直到 PR-3 才切。实现者若按 KD-3 在 PR-1 就删掉 `createQuestion`，老师会在 promote 落地前无法入库；若按 PR-1 字面做，KD-3 与「一条写路径」测试在 PR-1/PR-2 窗口为假。OQ-4 仍开放，等于第三种分叉。
- Evidence: KD-3；PR-1 描述「推荐本 PR 对 human POST 仍调用 `createQuestion`」；`lib/domain/question-repository.ts` `buildPersistedQuestionContract` 写死 `REVIEWED`。
- Suggestion: 把 KD-3 改成带阶段的句子：PR-3 起唯一插入路径是 `promoteDraftToQuestion`；PR-1 过渡允许 session 下的 `createQuestion`，并规定 PR-3 必须删除或把它收成 draft+promote 包装。OQ-4 在正文选定暂定项（4a 或 4b），不要让 KD 与 OQ 并列打架。
- Status: open

### Issue 2: 题图无法按文档预览：allowlist 指向不存在的读路由，skill 禁止 data URL
- Severity: major
- Section: 已有渲染/导出安全策略 / Skill §6 / Security & Privacy / create_raw_asset
- Description: `isSafeImageSrc` 只放行 `/assets/`、`/uploads/`、`/api/assets/`。仓库没有这些 GET handler，`next.config.ts` 为空，`uploads/` 在 gitignore 且文档明确「不要无鉴权暴露」。Skill 又禁止把图写成 data URL（会被丢掉）。结果：harness 上传了 IMAGE RawAsset，stem 里 `![图](...)` 要么写不进去、要么预览空白。物理题「如图所示」在 v1 校对台看不见图。
- Evidence: `lib/renderer/render-markdown.tsx` `isSafeImageSrc`；`next.config.ts` 空配置；文档 Security「今天没有 uploads 的 HTTP 读路由——保持这样，除非后续 `/api/assets/` 做会话保护」；Skill §6。
- Suggestion: 二选一写死：(a) v1 增加 **human session**（可选再加 `questions:read`/`drafts:read` agent）的 `GET /api/raw-assets/:id/file` 或 `GET /api/assets/...`，allowlist 加上该前缀，并禁止目录遍历；(b) 明确 v1 预览不渲染题图，RawAsset 只做溯源，skill 改为「不要在 stem 里嵌图，把图挂在 sourceRawAssetId，工作台左栏另开原图」。不要既禁止 data URL 又没有读路由。
- Status: open

### Issue 3: Editor cookie 的 `HMAC-SHA256(secret)` 未定义密钥、消息和编码
- Severity: major
- Section: Auth → Human auth 方案 a
- Description: 文档写 `Set-Cookie: physhub_editor=<HMAC-SHA256(secret)>`。HMAC-SHA256 需要 **key 与 message**。这里只给了一个参数，实现者会分别做成：SHA-256(secret)、HMAC(secret, secret)、HMAC(secret, "physhub_editor")、base64 vs hex。PR-1 的 cookie 校验会无法单测对齐，两个 PR 也可能各写一套。
- Evidence: Auth 节 cookie 行；对比 agent 节对 sha256+timingSafeEqual 的明确步骤。
- Suggestion: 写死算法，例如：`cookie = hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message="physhub_editor.v1"))`；校验时对计算出的 Buffer 做 `timingSafeEqual`。测试 header 只接受 **同一 cookie 值**，不接受明文 secret。
- Status: open

### Issue 4: `X-Physhub-Editor-Session` 在 production 接受明文 secret，绕过 HttpOnly cookie
- Severity: minor
- Section: Auth → 方案 a / OQ-1
- Description: 「无 cookie 则读 header，值仍是 secret 或同一 HMAC」。生产环境任意能设自定义头的客户端（CORS 配置失误、恶意扩展、SSRF）可用明文 secret 冒充老师，HttpOnly 失效。该头的正当用途只有 Vitest。
- Evidence: OQ-1；`readEditorSession` 描述。
- Suggestion: `NODE_ENV === "production"` 忽略该 header；非 production 只接受与 cookie 相同的 HMAC 值，或单独 `PHYSHUB_ALLOW_EDITOR_HEADER=true`。不要接受明文 secret。
- Status: open

### Issue 5: 同一文案 `Raw asset not found` 既是 404 又是 422
- Severity: minor
- Section: Agent Tool API Surface → 稳定 error 字符串 / Draft JSON 契约
- Description: 错误表 404 与 422 都列出 `Raw asset not found`。create/update draft 的未知 `sourceRawAssetId` 指定 422；不存在的 GET 资源通常 404。实现者与测试会对同一字符串绑两个 status。
- Evidence: 错误表 404 行与 422 行；Draft 契约「未知一律 422」。
- Suggestion: 422 保持 `Raw asset not found`（关系校验）；若 v1 没有 get-raw-asset 工具，从 404 行删掉该字符串。有 GET 时 404 仅用于「按 id 取资源不存在」。
- Status: open

### Issue 6: `submit_suggestions` 同时给 `draftId` 与 `questionId` 的行为未定义
- Severity: minor
- Section: Agent Tool API Surface → submit_suggestions
- Description: 「必须提供 `draftId` 或 `questionId` 之一」。两者都给、或给了已 promote 草稿的 draftId 且 questionId 为 null 时，accept 目标会歧义。Promote 会回填 `Suggestion.questionId`，但提交当下的校验规则没有。
- Evidence: 工具合同 §6。
- Suggestion: XOR：恰好一个非空。两个都给 → 400。仅 draftId 且草稿已 PROMOTED → 409 或自动改挂 `promotedQuestionId`（选一种写死）。
- Status: open

### Issue 7: 状态机画了 RawAsset PROCESSING/PARSED，现有 mock parse 从不更新 `RawAsset.status`
- Severity: minor
- Section: 状态机 / parse-raw-asset-workflow / OQ-3
- Description: 图中 `UPLOADED → PROCESSING → PARSED|FAILED`。`parseRawAssetWithClient` 只写 ParseJob 与 Draft，不 `rawAsset.update`。OQ-3b 若保留 HTTP parse，也没有指定补上状态翻转。实现者按图会加更新，按代码会不加。
- Evidence: `lib/domain/parse-raw-asset-workflow.ts`（无 rawAsset.status 写入）；状态机 mermaid。
- Suggestion: 若保留 mock parse：在成功路径把 RawAsset 设为 `PARSED`，失败 `FAILED`，开始时 `PROCESSING`。若 v1 不修 workflow，状态机标注「这些迁移仅在启用 mock parse 时发生，当前代码未实现，PR-8 一并补或删掉图中虚线」。
- Status: open

### Issue 8: v1 promote 只产生 `REVIEWED`，但示例/搜索仍把 `PUBLISHED` 当默认可用集
- Severity: minor
- Section: search_questions 示例 / 状态机 / Human UI `/questions`
- Description: v1 无 publish 路由，正式题停在 `REVIEWED`。search 示例 `constraints.status: ["REVIEWED", "PUBLISHED"]` 能工作，但 2026-05-15 与自然语言「已发布」会理解成 PUBLISHED（`question-search.ts` 对 published 会 normalize 成 PUBLISHED），结果为空。Skill 未写「v1 请用 REVIEWED」。
- Evidence: 工具合同 search 示例；`app/(dashboard)/questions/page.tsx` 已用 REVIEWED|PUBLISHED；`understandQuestionSearchQuery` 不把「发布」映射到 REVIEWED。
- Suggestion: Skill 与 search 合同写明：v1 官方可检索状态是 `REVIEWED`；不要只传 `PUBLISHED`。可选：NL「已发布/入库」映射到 REVIEWED（这是搜索实现细节，可放 PR-5 测试）。
- Status: open

### Issue 9: Promote 写入 `QuestionVersion` 时未指定 `createdBy` vs `createdById`
- Severity: nit
- Section: Promote 事务步骤 3 / prisma QuestionVersion
- Description: 模型同时有无关系的 `createdBy String?` 与 `createdById`。步骤只说 create version=1 snapshot，没说填哪个。现有 schema 注释意图是 User 关系走 `createdById`。
- Evidence: `prisma/schema.prisma` QuestionVersion；Promote 步骤 3。
- Suggestion: 填 `createdById: OWNER.id`，`createdBy` 留空或不再写入；禁止两套各写各的。
- Status: open

### Issue 10: Skill 未要求保存返回的 `draft.id`，也无 list-drafts 工具
- Severity: nit
- Section: Skill Package / 工具总表
- Description: 崩溃的 harness 无法找回自己刚建的草稿。v1 可不做 list，但 skill 必须写「把 201 的 draft.id 记下来，后续 PATCH/quality-check/suggestion 都用它」。
- Evidence: 工具总表无 list drafts；Skill 小节无 persist id。
- Suggestion: Skill 加一条；v1 仍不做 agent list。
- Status: open

### Issue 11: 解锁限流「每 IP」未定义反代头
- Severity: nit
- Section: Auth 解锁限流
- Description: Next 多进程或前面有反代时，`request.ip` 可能都是 127.0.0.1，限流失效或误伤。小团队可接受，但应写「直连用连接 IP；若设 `TRUST_PROXY=true` 才读 `X-Forwarded-For` 第一跳」。
- Evidence: 「每 IP 每分钟最多 5 次失败」；「内存计数即可（单进程）」。
- Suggestion: 补一句信任边界；默认不信任 X-Forwarded-For。
- Status: open

## PR Plan review

顺序仍正确。PR-1 过渡 `createQuestion` 必须与修订后的 KD-3 对齐（Issue 1）。若选 Issue 2 方案 a，读图路由应进 PR-5 或 PR-1 的 human 面，并加入 `app/api/**` 枚举验收。PR-8 应认领 RawAsset 状态翻转或从状态机删除虚线。

## Fact-check vs repo

抽查通过，与修订稿现状陈述一致。额外确认：

- `parse-raw-asset-workflow.ts` 不更新 `RawAsset.status`（Issue 7）。
- `questionInputSchema` 仍无 `tagIds`；promote 写 tags 必须在 schema 校验之外另走 draft.tagIds（文档已暗示，可在 Promote 步骤 2 点名）。
- `app/api/**` 今日 13 个 route.ts，与空洞表一致。
- 无 `prisma/migrations/`、无 `middleware.ts`、无 asset GET。
