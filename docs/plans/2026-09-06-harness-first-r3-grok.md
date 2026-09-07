# Grok Re-audit Round 3: Physhub Harness-First Agent Platform

| 字段 | 值 |
| --- | --- |
| Auditor | Grok |
| Date | 2026-09-06 |
| Document | docs/plans/2026-09-06-harness-first-agent-platform.md (1471 lines) |
| Round | 3 |
| Verdict | Approve |

## Executive Summary

Round 2 合并的 16 条在现行文档中均已写死为可测试规则，未发现新的互斥实现路径。Grok 本轮 **0 open issues**。

## Previous issues verification (Round 2 combined 1–16)

1. KD-3 分阶段 / OQ-4a — **fixed**（Goals §3、KD-3、PR-1/PR-3）
2. 题图 GET — **fixed**（allowlist `/api/raw-assets/`、human+agent file 路由、agent 未挂 draft/question → 404）
3. HMAC 公式 — **fixed**（`hex(HMAC-SHA256(key=EDITOR_SESSION_SECRET, message="physhub_editor.v1"))`）
4. Agent send-back — **fixed**（mermaid human only；契约单向 DRAFT→NEEDS_REVIEW）
5. Promote 事务内重读 — **fixed**（KD-14）
6. 幂等同事务 + 2 min 回收 — **fixed**
7. 400 vs 409 — **fixed**（`Invalid draft status` / `Draft is not updatable` 均在错误表）
8. 测试 header — **fixed**（non-prod、仅 HMAC）
9. path 404 / body 422 — **fixed**
10. suggestion XOR — **fixed**
11. RawAsset.status — **fixed**（PR-8）
12. 搜索 REVIEWED — **fixed**（skill/PR-6）
13. promote 扩展 helper — **fixed**
14. QuestionVersion.createdById — **fixed**
15. skill 保存 draft.id — **fixed**
16. TRUST_PROXY — **fixed**

## What is solid

文档已达到「按 PR Plan 可实现且两边审计口径一致」的程度。残余产品选择仅 OQ-2（v1 不改）、OQ-3、OQ-5、OQ-6，均不阻塞 PR-0/1。

## Issues

None.

## PR Plan review

PR-0 → PR-1（过渡 createQuestion）→ PR-2（draft + human file GET + HMAC cookie 消费）→ PR-3（promote + OQ-4a）顺序自洽。GET file 落在 PR-2 使校对台预览不依赖 PR-5。

## Fact-check vs repo

Round 2 事实抽查仍然成立。本轮只核对修订句与仓库未实现部分（GET file 尚不存在、HMAC 尚未编码）——这是设计预期，不是文档撒谎。
