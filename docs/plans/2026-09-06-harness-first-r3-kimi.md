# Kimi Round 3 Final Audit — Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI（独立架构审计员） |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md（1471 行，sed 分段读完全文） |
| Round | 3 |
| Prior review | docs/plans/2026-09-06-harness-first-r2-combined.md（Issue 1–16 声称 addressed） |
| Verdict | Needs revision（0 critical / 0 major / 1 minor / 4 nit） |

## Round 2 Issue 逐条复核（1–16）

| # | 判定 | 证据 |
| --- | --- | --- |
| 1 KD-3 与 PR-1 过渡期互斥 | **fixed** | Goals #3、KD-3 改为分阶段（PR-1 过渡 `createQuestion` / PR-3 起 promote 唯一）；OQ-4 标注「已选定 4a，不再开放」；空洞表与 PR-1/PR-3 描述同步 |
| 2 题图无读路由 | **fixed** | 新增 human `GET /api/raw-assets/:id/file`（PR-2）与 agent `GET /api/agent/raw-assets/:id/file`（PR-5，linkage 选 scope，非 hasAnyScope）；allowlist 加 `/api/raw-assets/`；空洞表、human API 表、Skill §6 同步。仓库核实：现 allowlist 仅 `/assets/`、`/uploads/`、`/api/assets/`，确需此项 |
| 3 Cookie HMAC 未定义 | **fixed** | 公式写死 `hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message="physhub_editor.v1"))`，`timingSafeEqual`，KD-5 / OQ-1 / Auth 节三处一致 |
| 4 Agent send back 矛盾 | **fixed** | mermaid 标「agent 仅此方向」、状态表标 human-only；agent zod `status` 仅 `NEEDS_REVIEW`；非法枚举 400 `Invalid draft status`；测试表覆盖 |
| 5 Promote 校验在事务外 | **fixed** | Promote 顺序改为仲裁 `updateMany` → 事务内重读 → 重读内容校验 → 建 Question；失败整体回滚；测试表有「事务内重读，以重读为准」 |
| 6 幂等 completed 不同事务 | **fixed** | 步骤 3 明确业务写 + AgentRun + `completed` 同一 `$transaction`；失败删占位；`in_progress` > 2min 条件回收；KD-10 同步 |
| 7 `Draft is not updatable` 未进错误表 | **fixed** | 400 `Invalid draft status` 与 409 `Draft is not updatable` 均入稳定错误表，语义分流写清 |
| 8 测试 header 接受明文 secret | **fixed** | `X-Physhub-Editor-Session` 仅 non-prod 且 cookie 缺失时读取，只接受同款 hex HMAC；生产完全忽略；测试表覆盖 |
| 9 同一错误串跨 404/422 | **fixed** | 规则写死「path id → 404；body 外键 → 422」，并在 Draft 契约、4b、promote 步骤 4 一致应用 |
| 10 suggestion 双 id 未定义 | **fixed** | XOR：都给/都不给 → 400 `Provide exactly one of draftId or questionId`；仅 draftId 且 PROMOTED 有 `promotedQuestionId` → 自动挂 Question，否则 409 |
| 11 mock parse 不写 RawAsset.status | **fixed** | 状态机表与 PR-8 写明保留 parse 则必须 `PROCESSING → PARSED/FAILED`。仓库核实：`parse-raw-asset-workflow.ts` 只写 ParseJob/draft status，确无 RawAsset.status 更新，缺口属实、修复点正确 |
| 12 search 示例强调 PUBLISHED | **fixed** | 示例改 `["REVIEWED"]`；agent 与 human 未传 status 均默认 REVIEWED；Skill §9 写明不要只搜 PUBLISHED |
| 13 promote 复用 helper 丢字段 | **fixed** | Promote 步骤 5 与 KD-14 明确禁止只 spread `buildPersistedQuestionContract`，必须补 `sourceRawAssetId` 与 `QuestionTag` join。仓库核实：Pick 确实无 `sourceRawAssetId`，`createQuestionWithCandidate` 确实不建 QuestionTag |
| 14 Version createdBy vs createdById | **fixed** | 步骤 6 只填 `createdById: OWNER.id`，`createdBy` 保持 null。仓库核实：schema 两个字段都在，`createdBy` 为无关系遗留 String |
| 15 Skill 未要求保存 draft.id | **fixed** | Skill §7「Persist `draft.id`」；PR-6 描述同步 |
| 16 限流未定义反代头 | **fixed** | 默认 TCP 连接 IP，忽略 `X-Forwarded-For`/`X-Real-IP`，除非 `TRUST_PROXY=true`；`.env.example` 与 PR-1 同步 |

结论：16/16 真正修住，仓库事实引用（Pick 字段、dev scopes、allowlist、parse workflow、QuestionVersion 双字段）抽验全部属实。

## Issues（Round 3 新发现）

### Issue R3-1: `submit_suggestions` 示例与 XOR 规则在显式 `null` 上互斥
- Severity: minor
- Section: Agent Tool API → 6. `submit_suggestions` / 7. `check_question_quality`
- Description: XOR 规则写「两个都给或两个都不给 → 400 `Provide exactly one of draftId or questionId`」，但紧邻的请求示例却同时出现 `"draftId": "…"` 与 `"questionId": null`。显式 `null` 算「给了」还是「没给」未定义：一个实现会把示例请求拒成 400（zod 非空检查），另一个会放行（`?? undefined`）。`check_question_quality` 的「Body 二选一」有同样歧义。这正落在「错误码互斥实现」的通过标准上。
- Evidence: 示例 JSON 含 `"questionId": null`；规则文本「两个都给或两个都不给 → 400」。
- Suggestion: 写死「显式 `null` 视为未提供（先 `?? undefined` 再判 XOR）」，或把示例中的 `"questionId": null` 一行删掉。二选一即可，`check_question_quality` 同步一句。
- Status: addressed
- Response: 采用「`null` / 省略 / `""` 视为未提供，再判 XOR」。示例删除 `"questionId": null`。quality-check 同样只允许一个键。

### Issue R3-2: 重复提交 `NEEDS_REVIEW` 的结果码未定义
- Severity: nit
- Section: Draft JSON 契约（`updateQuestionDraft` actor 分流）
- Description: Agent 的 `status` 仅允许 `NEEDS_REVIEW`「且仅当当前行为 `DRAFT`」。当前行已是 `NEEDS_REVIEW` 时 agent 再 PATCH `status: "NEEDS_REVIEW"`：不是非法枚举（不适用 400）、不是 PROMOTED/REJECTED（不适用 409）。实现者会在「200 no-op」与「400/409」之间分叉；harness 丢了响应换 key 重试「标记待审」时结果不定。
- Suggestion: 写死一种：建议同状态重复设置 → 200 no-op（幂等友好），或明确归 409。Human PATCH 同状态重设顺带一句。
- Status: addressed
- Response: 同状态重复设置 → 200 no-op（agent 与 human）。不 400、不 409。

### Issue R3-3: agent 无法读回自己刚上传但尚未挂接的 RawAsset
- Severity: nit
- Section: 4b. `get_raw_asset_file` / Skill §6
- Description: 授权只认 linkage：挂在 Question → `questions:read`，挂在 Draft → `drafts:read`，否则 404。harness `create_raw_asset` 成功后、draft 创建前（或 draft 创建 422 失败期间），该 asset 无任何 linkage，上传者自己也读不回 → 404。Skill §6 又写「用 `get_raw_asset_file` 读取」。agent 本地有文件副本所以不阻塞主流程，但契约与 skill 指引在此处会误导。
- Suggestion: 补一句「上传后须先挂到 draft/question 才可读回；未挂接 asset 对 agent 不可读（404），重读请走本地原件」，或给上传者本人（同 apiKeyId + 未挂接）放行。二选一写明。
- Status: addressed
- Response: 采用「有 `drafts:create` 可 GET 未挂接 RawAsset（上传后预览）」。已挂接仍按 linkage + 对应 read scope。Skill 写明不必先建 draft。

### Issue R3-4: 数据流时序图与 Promote 正文顺序相反
- Severity: nit
- Section: 默认产品数据流（mermaid sequenceDiagram）vs Promote（human-only）
- Description: 时序图画的是 `P->>D: validatePublishableQuestion` 先于 `D->>DB: Question REVIEWED + ... PROMOTED`；正文（Round 2 Issue 5 修复）要求事务内先条件 `updateMany` 仲裁置 PROMOTED、再重读、再校验、失败回滚。只读图的实现者会退回「先校验后仲裁」的竞态写法。
- Suggestion: 时序图改为 `P->>D: 事务：条件 updateMany 仲裁 → 重读 → validatePublishableQuestion`，或在 Note 里写明「校验在仲裁之后、同事务，详见 Promote 节」。
- Status: addressed
- Response: 时序图改为仲裁→重读→validate→建 Question，Note 写明同事务失败回滚。

### Issue R3-5: 稳定 error 表被 404/422 规则段截断，429/500 两行脱离表头
- Severity: nit（纯格式，但有契约后果）
- Section: 稳定 `error` 字符串表
- Description: 「**404 vs 422：**…」段落插在 422 行与 `| 429 |` / `| 500 |` 行之间，Markdown 渲染时表格在此断开，429/500 两行变成无表头的散行。渲染视图下读者可能漏掉 `Too many unlock attempts`（429）与既有 500 字符串是锁定契约。
- Suggestion: 把该段落移到整张表之后，429/500 行并回表内。
- Status: addressed
- Response: 429/500 收回表内；404 vs 422 说明移到整张表之后。

## Revision Summary

- 2026-09-06 Round 3（Kimi 终审）：Round 2 的 16 条全部判定 **fixed**，关键仓库引用抽验属实（`question-repository.ts` Pick 列表与 QuestionTag、`agent-auth.ts` devAgentScopes、`render-markdown.tsx` allowlist、`parse-raw-asset-workflow.ts` status 行为、`schema.prisma` QuestionVersion 双字段）。新发现 5 条：1 minor（显式 null vs XOR）+ 4 nit（同状态重设结果码、未挂接 asset 读回、时序图顺序、错误表断裂）。无 critical / major。鉴权、promote、幂等、题图读取四条主线已互洽；剩余唯一可能影响「错误码互斥实现」标准的是 R3-1。修掉 R3-1（及顺手 4 条 nit）后可 Approve。
- 2026-09-06 Round 3 修订：R3-1–R3-5 全部 **addressed**（见各条 Response）。设计文档两份 identical。
