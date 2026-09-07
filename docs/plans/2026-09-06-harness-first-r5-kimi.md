# Kimi Round 5 Final Audit — Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI（独立架构审计员） |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md（1482 行，/bin/sed 分段读完全文，无 offset 跳读） |
| Round | 5 |
| Prior review | /tmp/grok-tdcasual/kimi-reaudit-r4.md（Issue R4-1–R4-4 声称 addressed） |
| Verdict | Approve（0 critical / 0 major / 0 minor / 0 nit） |

## Round 4 Issue 逐条复核（R4-1–R4-4）

| # | 判定 | 证据 |
| --- | --- | --- |
| R4-1 quality-check XOR 错误串未入稳定 error 表 | **fixed** | 稳定 `error` 字符串表新增独立行：`400 | Provide exactly one of draftId or question | check_question_quality 违反 XOR（尾词是 question 不是 questionId）`，与正文 §7「两个都给 → 400 `Provide exactly one of draftId or question`」一致；原 `draftId or questionId` 行保留给 `submit_suggestions`，两条 XOR 文案均表内可查、来源列分明 |
| R4-2 `get_raw_asset_file` 双 linkage 优先级未定义 | **fixed** | §4b 新增显式优先级链：1) Question linkage 且有 `questions:read` → 200；2) 否则 Draft linkage 且有 `drafts:read` → 200；3) 否则未挂接且有 `drafts:create` → 200；4) 否则 404。并写明「即：Question linkage（`questions:read`）> Draft linkage（`drafts:read`）> 未挂接（`drafts:create`）。每步只检查一条 required list，不是 hasAnyScope」，且指出 promote 后 draft 侧 `sourceRawAssetId` 不清除、双挂是常态。工具总表与 PR-5 文件清单同步同一优先级 |
| R4-3 accept 缺 `difficulty` 键语义未定义 | **fixed** | 写入语义第 2 步（Question 目标）写明：「`difficulty`：**无 `difficulty` 键则不改**；`difficulty: null` 清空（写 `null`）；有数字则写入该值。与 `tag_ids` 对齐。」第 3 步（Draft 目标）：「`difficulty` / `tagIds` 规则同上（无键不改；`null` 或空数组清空）」——三分支与 `tag_ids` 完全对齐，无歧义 |
| R4-4 normalize 只写「更新」未写「创建」 | **fixed** | Draft JSON 契约末尾改为：「`normalizeQuestionInput` 会把 label 转大写。**draft 创建与更新都走同一 normalize**（当 answer/options 都出现时），避免 create 存 `"b"`、update 存 `"B"`」——create/update 存储形态分叉被一句话消除 |

结论：R4-1–R4-4 全部真正修住，修订落点（错误表、§4b、工具总表、PR-5、写入语义、Draft 契约）逐一在现行文档中核实，无口头修复。

## 互斥实现扫描（同一请求 → 两种 HTTP status / 两种 DB 写入）

按通过标准对全文做矛盾扫描，重点复核以下高风险交叉点，均未发现互斥实现：

- **XOR 错误串**：`submit_suggestions`（`draftId or questionId`）与 `check_question_quality`（`draftId or question`）是两个不同工具的两条不同文案，正文与错误表一致，非同一请求两种状态。
- **file GET scope**：§4b 四分支链 + 「每步只检查一条 required list」唯一确定行为；调用方缺全部对应 scope 时统一 404（不泄露存在性），两处（§4b、测试表「文件 GET 鉴权」行）表述一致。
- **400 vs 409（draft status）**：非法枚举值（actor 不允许）→ 400 `Invalid draft status`；行已 `PROMOTED`/`REJECTED` → 409 `Draft is not updatable`；同状态重设 → 200 no-op。三规则在契约节、工具合同、测试表、PR-2 描述中一致，按条件互斥分支划分，无重叠。
- **404 vs 422**：path id → 404，body 引用 → 422；同一字符串（如 `Raw asset not found`）按 id 位置分流，规则段与各处用例（file GET、draft create、promote、submit_suggestions）一致。
- **403 文案分流**：publish/promote 特化 `Agent cannot publish questions`，其它 human 路由 `Agent key not accepted on human routes`；错误表、Auth 节、空洞表、KD-15、测试表五处一致。
- **401 vs 403**：无认证 → 401；合法 agent Bearer 打 human 路由 → 403；agent 路由缺 scope → 401。规则单一，无冲突分支。
- **promote 并发**：仲裁失败、P2002、串行重放统一 409 `Draft is not promotable`；成功恰好一行 Question。测试表与正文一致。
- **PR-1 过渡 vs PR-3 终态**：`POST /api/questions` 分阶段（PR-1 直写 REVIEWED → PR-3 起 draft+promote 包装），每阶段行为唯一，KD-3 / Goals-3 / 空洞表 / PR Plan 一致，是时间分片而非互斥。
- **Suggestion accept 写入**：replace-of-kind 语义下 `difficulty` / `tag_ids` / `knowledgePointIds` 缺键不改、null/空数组清空、有值整份替换；Question 与 Draft 两目标规则对齐；PROMOTED draft 由 promote 回填 `questionId` 后 accept 写 Question，与 submit_suggestions 的自动挂接一致。
- **Idempotency**：占位先插、业务写+AgentRun+completed 同事务、失败删占位、completed 回放不再写 AgentRun、2 分钟回收；正文行为段、数据模型、测试表、KD-10 一致。
- **QuestionVersion**：只写 `createdById`，遗留 `createdBy` 保持 null；正文步骤 6 与测试表「promote 带上图和标签」行一致。

未发现「同一请求会被实现成两种不同 HTTP status 或两种不同 DB 写入」的矛盾。

## Issues

None.

## Revision Summary

- 2026-09-06 Round 5（Kimi 终审）：Round 4 的 4 条 nit 全部判定 **fixed**，修订落点逐一在现行文档核实（quality-check XOR 文案入错误表并标注来源；file GET 优先级链 Question > Draft > 未挂接且与工具总表/PR-5 同步；accept 无 `difficulty` 键不改、`null` 清空且 Draft 侧对齐；normalize 覆盖 create 与 update）。全文互斥实现扫描未发现同一请求两种 status / 两种 DB 写入的矛盾。0 critical / 0 major / 0 minor / 0 nit。满足通过标准，**Approve**。

KIMI_REAUDIT_WRITTEN 5 0 0 0 0 APPROVE
