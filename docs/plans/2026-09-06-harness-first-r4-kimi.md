# Kimi Round 4 Final Audit — Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI（独立架构审计员） |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md（1477 行，/bin/sed 分段读完全文，无 offset 跳读） |
| Round | 4 |
| Prior review | docs/plans/2026-09-06-harness-first-r3-kimi.md（Issue R3-1–R3-5 声称 addressed） |
| Verdict | Needs revision（0 critical / 0 major / 0 minor / 4 nit） |

## Round 3 Issue 逐条复核（R3-1–R3-5）

| # | 判定 | 证据 |
| --- | --- | --- |
| R3-1 显式 null vs XOR | **fixed** | `submit_suggestions` 写明「`null`、省略、以及只含空白的 `""` 都视为未提供（先 trim / `?? undefined` 再计数）」；示例已删 `"questionId": null` 行；`check_question_quality` 同步「`null` / 省略 / `""` 视为未提供，再判 XOR」「不要写 `"question": null`」；测试表有「XOR 视 null 为未提供 → 201」与 suggestion XOR 行 |
| R3-2 同状态重设结果码 | **fixed** | Draft 契约新增「**同状态重复设置 → 200 no-op**（不 400、不 409）」，agent NEEDS_REVIEW 与 human DRAFT 两个例子都点到；测试表有「同状态重设 no-op」行 |
| R3-3 未挂接 RawAsset 读回 | **fixed** | 4b 新增「未挂接：调用方有 `drafts:create` → 200（上传后立刻预览，不必先建 draft）」；工具总表 `get_raw_asset_file` scope 列同步；Skill §6 改为「上传后即可 get_raw_asset_file…不必先建 draft」；测试表有「未挂接 asset 可读」行 |
| R3-4 时序图与 Promote 顺序相反 | **fixed** | sequenceDiagram 改为 `P->>D: 事务：条件 updateMany 仲裁 → 重读 → validate → 建 Question`，并加 `Note over P,D: 校验在仲裁之后、同事务；失败整体回滚`，与 Promote 正文五步一致 |
| R3-5 错误表被截断 | **fixed** | `429 Too many unlock attempts` 与 `500` 两行已收回表内；「**404 vs 422：**」段落移到整张表之后 |

结论：R3-1–R3-5 全部真正修住，修订落点（契约节、工具总表、Skill、测试表、时序图、错误表）逐一在现行文档中核实，无口头修复。

仓库事实抽验（本轮新引用）：`Suggestion.createdByAgentRunId` 存在（schema.prisma:245）；`QuestionVersion` 确有 `createdBy`（遗留 String?）与 `createdById` 双字段（schema.prisma:227-228）；`app/api/**` 全量枚举与空洞表一致（questions、questions/[id]、questions/[id]/classify、search/questions、knowledge-points、tags、raw-assets、raw-assets/[id]/parse、suggestions/[id]、question-sets、question-sets/[id]/export；无 GET question-sets/[id] 路由，空洞表未虚列）。

## Issues（Round 4 新发现）

### Issue R4-1: `check_question_quality` 的 XOR 错误串未进稳定 error 表
- Severity: nit
- Section: Agent Tool API → 稳定 `error` 字符串表 / 7. `check_question_quality`
- Description: R3-1 修复给 quality-check 引入了第二条 XOR 文案 `Provide exactly one of draftId or question`（注意尾词是 `question` 不是 `questionId`），但稳定 error 表 400 行只登记了 `Provide exactly one of draftId or questionId`，来源标注仅 `submit_suggestions 违反 XOR`。契约测试若按表锁字符串，quality-check 这条会无人认领；若按正文锁，表又不完整。与 R2-7 / R3-5 同类（稳定错误串必须表内可查）。
- Evidence: 正文 §7「两个都给 → 400 `Provide exactly one of draftId or question`」；错误表 400 行仅 `Provide exactly one of draftId or questionId`。
- Suggestion: 把 `Provide exactly one of draftId or question` 补进 400 行（来源标 `quality-check` XOR），或统一两条 XOR 共用同一字符串并在来源列写两个工具。二选一。
- Status: addressed
- Response: 错误表新增独立 400 行 `Provide exactly one of draftId or question`（来源 quality-check）。submit_suggestions 仍用 `…questionId`。

### Issue R4-2: `get_raw_asset_file` 同时挂 Draft 与 Question 时 required scope 选择未定义
- Severity: nit
- Section: 4b. `get_raw_asset_file` / 工具总表对应行
- Description: R3-3 的修复把 scope 规则写成三分支：未挂接 → `drafts:create`；已挂 Question → `questions:read`；已挂 Draft → `drafts:read`，且明确「按 linkage 选一条 required list，不是 hasAnyScope」。但 promote 后 Draft 行的 `sourceRawAssetId` **不清除**（Promote 步骤 5 只写 Question 侧），同时 Question 也带同一字段——「已挂 Draft」与「已挂 Question」同时成立恰恰是 promote 后的常态，而非边缘案例。两条 linkage 命中时选哪一条 required list 未写死：Question 优先则只有 `drafts:read` 的 key 读自己促成的图会 404，Draft 优先则反之。落在「每条路由恰好一个 required scope」硬约束的实现分叉上。
- Evidence: Promote 正文无任何清除 draft `sourceRawAssetId` 的步骤；4b 三分支无优先级语句。
- Suggestion: 写死优先级（建议「Question linkage 优先于 Draft linkage，再落未挂接分支」一句），或显式允许该路由按调用方持有 scope 匹配任一已挂 linkage（此时需豁免「不是 hasAnyScope」一句并说明理由）。
- Status: addressed
- Response: 采用 Question linkage（`questions:read`）> Draft linkage（`drafts:read`）> 未挂接（`drafts:create`）。Promote 不清除 draft.`sourceRawAssetId`。

### Issue R4-3: Suggestion accept 对 payload 缺 `difficulty` 键的语义未定义
- Severity: nit
- Section: Suggestion accept 写哪些字段 → 写入语义（replace-of-kind）
- Description: tags 有明确三分支——「无 `tag_ids` 键则不改 tags；空数组则清空」。`difficulty` 没有对应规则：步骤 2 写 `question.update({ primaryKnowledgePointId, difficulty })`，payload 缺 `difficulty` 键时是实现成「保持不变」还是「写 null 清空」未定义；Draft 分支「直接覆盖 … `difficulty`」同样有歧义。两个实现会在同一条 accept 上产生不同的正式题 difficulty。
- Evidence: 写入语义第 1 步校验只列 `knowledge_points[].id` 与 `tag_ids`；difficulty 无任何缺省规则。
- Suggestion: 补一句与 tag_ids 对齐的规则，例如「无 `difficulty` 键则不改 difficulty；`difficulty: null` 视为清空」（或要求 metadata payload 必带 difficulty，缺则 400）。任选其一写死。
- Status: addressed
- Response: 与 tag_ids 对齐：无 `difficulty` 键不改；`difficulty: null` 清空。Question/Draft 同一规则。

### Issue R4-4: normalize 只写「更新」未写「创建」，create/update 存储形态分叉
- Severity: nit
- Section: Draft JSON 契约 末尾
- Description: 「`normalizeQuestionInput` 会把 label 转大写；draft **更新**也应走同一 normalize（当 answer/options 都出现时）」——只点名更新。`create_question_draft` 是否同样 normalize 未写。create 存小写 `answer.value: "b"`、update 存大写 `B`，库内 draft 的 `answerJson` 形态不一致；虽然 promote 时会再跑 `normalizeQuestionInput` 兜底（步骤 2），但 `get_question_draft` 读回与工作台展示在 create-only 路径上拿到的是未规范化值。
- Evidence: 契约句仅含「更新」；`create_question_draft` 节无 normalize 语句。
- Suggestion: 把该句改为「draft 创建与更新都走同一 normalize（当 answer/options 都出现时）」，或显式写明 create 存原样、promote 时才 normalize。一句即可。
- Status: addressed
- Response: 改为 draft 创建与更新都走同一 normalize（当 answer/options 都出现时）。

## Revision Summary

- 2026-09-06 Round 4（Kimi 终审）：Round 3 的 5 条全部判定 **fixed**，修订落点逐一在现行文档核实（XOR null 规范化与示例、同状态 200 no-op、未挂接 asset `drafts:create` 可读、时序图仲裁→重读→validate、错误表 429/500 收回表内）。仓库抽验属实（`Suggestion.createdByAgentRunId`、QuestionVersion 双字段、`app/api/**` 空洞枚举）。新发现 4 条 nit：quality-check XOR 错误串未入稳定错误表、file GET 双 linkage 优先级、accept 缺 `difficulty` 键语义、normalize 未覆盖 create。无 critical / major / minor。R3-3 修复本身引入了 R4-2 的双 linkage 缺口（promote 后 draft 侧 `sourceRawAssetId` 不清除，双挂是常态）。四条均是一句话级修复；全部关掉后满足「0 open（含 nit）」即可 Approve。

KIMI_REAUDIT_WRITTEN 4 0 0 0 4 NEEDS_REVISION

- 2026-09-06 Round 4 修订：R4-1–R4-4 全部 **addressed**（见各条 Response）。设计文档两份 identical。
