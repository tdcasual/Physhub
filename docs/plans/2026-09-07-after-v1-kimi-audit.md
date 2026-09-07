# Kimi Audit: After-v1 Next Plan

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI |
| Date | 2026-09-07 |
| Document | docs/plans/2026-09-07-after-v1-next-plan.md |
| Branch checked | execute-plan/2151bf2e-pr-8-demote-mock-workers-to-test-fixtures |
| Verdict | Approve with issues |

## Executive Summary

方案对「当前真实缺口」的事实陈述几乎全部与栈顶代码一致，我逐行核对后没有发现编造或夸大的缺口。Phase A → B → C 的分层（先发布主线、再让老师免 curl、最后才谈检索/分发）符合 v1 harness-first 边界，Key Decisions 与 PR 切分整体合理。唯一实质问题是 **A1（合栈进 master）排在 A4（解锁页）之前**：合栈后 master 上的人类写路径（保存草稿、promote）全部 401 且浏览器内无任何获取 cookie 的入口，「可发布主线」在 A4 落地前是名不副实的。另有两处小的事实性瑕疵（A6 验收里的状态码写错、README 过期句子引用不完整）。结论：批准，但建议调整 A1/A4 顺序并修正细节。

补充核实：栈顶 `npm test` 实际跑通 **37 files / 356 passed**（2026-09-07 复跑，20.6s），与方案声明一致。`master` 与 `origin/master` 同指 d59047f，落后栈顶 17 个 commit；9 个 execute-plan 分支均已推到 origin；`gh pr list --state all` 为空，确认未开任何 GitHub PR。

## Fact-check vs repo

对「当前真实缺口」表逐行核对：

| 方案声称的缺口 | 结论 | 证据 |
| --- | --- | --- |
| 9 个 PR 未合 master、未开 GitHub PR | confirmed | `git log master..HEAD` = 17 commits；`git show master:app/api/questions/route.ts` 仍是无认证的 `createQuestion` 直写；`gh pr list --state all` 输出为空；9 个分支在 origin 上存在 |
| 设计文档 `2026-09-06-harness-first-*.md` 未跟踪 | confirmed | `git status --short`：全部 `docs/plans/2026-09-06-*` 及本方案文件均为 `??` 未跟踪；已跟踪的只有 `2026-05-15-*` 两份旧方案 |
| README / development.md 仍写「未鉴权 / POST 直写 REVIEWED」 | confirmed | README.md:23「this branch does not yet reject requests if it is missing」；README Secrets 表「Those routes are still unauthenticated on this branch」；README「Today that POST still writes a `REVIEWED` question directly」「That package lands in a later PR」「Today those routes still run unauthenticated」；docs/development.md:15「this branch does not yet reject unauthenticated human requests」 |
| 没有解锁页（editor-session 路由在，layout 不检查 cookie） | confirmed | `app/api/auth/editor-session/route.ts` 存在（401/429、Set-Cookie）；`app/layout.tsx` 只渲染 `<Nav/>`+children，无 cookie 检查；`components/nav.tsx` 无解锁入口；`grep unlock/physhub_editor` 在 app/、components/ 下零命中（仅 `lib/auth/human-auth.ts` 定义 cookie 名） |
| 没有 `scripts/create-api-key.ts` | confirmed | 仓库根无 `scripts/` 目录；全仓 grep `create-api-key` 只命中两份计划文档 |
| 组题/导出只有 API 没有 UI | confirmed | `app/api/question-sets/route.ts`（POST）与 `app/api/question-sets/[id]/export/route.ts`（POST）存在；`components/search/question-search-panel.tsx` 无加篮/建组逻辑；`app/(dashboard)/` 下无 question-sets 页面 |
| 正式题没有内容 PATCH（OQ-6） | confirmed | `app/api/questions/[id]/route.ts` 只有 `GET`（外加 `classify` 子路由），无 PATCH/PUT |
| 知识点/标签没有管理 UI | confirmed | 仅 `app/api/knowledge-points/route.ts`、`app/api/tags/route.ts`；`app/(dashboard)/` 下只有 drafts 与 questions 两棵子树 |
| 没有 upload 页面 | confirmed | `components/question/question-editor.tsx`、`components/draft/draft-review-workspace.tsx` 中无任何对 `/api/raw-assets` 的 fetch；人传原图只能 curl/harness |
| 没有栈顶 E2E | confirmed | `tests/e2e/` 只有 `smoke.spec.ts`，内容为「打开首页 → 点 New draft → 看 KaTeX 预览」，不覆盖解锁/保存/promote |
| 没有在真实 Postgres + 浏览器上验收 | confirmed（间接） | 属过程性声明，仓库无法直接证明；但与 E2E 仅有 smoke、未合栈的事实一致。列入 Doubts |

方案表格外的关键声明核对：

- 「POST /api/questions 现在是 draft+promote 包装」：**confirmed**。`app/api/questions/route.ts` 走 `requireHumanApiAuth(request, { publishRoute: true })` + `createQuestionByPromotingDraft`，不再直写 REVIEWED。
- 「`ENABLE_MOCK_*` 默认关」：**confirmed**。`app/api/raw-assets/[id]/parse/route.ts:22` 与 `app/api/questions/[id]/classify/route.ts:23` 均为 `process.env.ENABLE_MOCK_* !== "true"` 即拒绝。
- 「导航 Questions / Drafts / New draft」：**confirmed**（components/nav.tsx）。
- 「相对 master 17 commit」「栈顶分支名」：**confirmed**。
- 「单测 37 files / 356 passed」：**confirmed**（本次复跑）。
- 前置 v1 方案的 promote 设计（同事务仲裁、422 KP 校验等）已在 `lib/domain/promote-draft.ts` 落地，本方案对其引用准确。

## Doubts

1. **Question:** 「未在真实 Postgres + 浏览器上验收」是否属实？
   **Files inspected:** tests/e2e/smoke.spec.ts、playwright.config.ts、git log
   **What remains unclear:** 这是过程性事实，仓库里只有间接证据（E2E 仅 smoke、栈未合）。无法排除作者在仓库外手工验收过；但即便验收过，也因未合栈而不可复现，不影响方案结论。

2. **Question:** A4 解锁页落地前，dashboard 的 server components 是否会让无 cookie 访客读到题目内容？
   **Files inspected:** `app/(dashboard)/drafts/page.tsx`、`app/(dashboard)/drafts/[id]/page.tsx`、`app/(dashboard)/questions/page.tsx`
   **What remains unclear:** 这三个页面都直接用 server-side prisma 读库渲染，不检查 `physhub_editor` cookie——即当前栈顶**读**是公开的、只有 API **写**被锁。方案 A4 的表述（无 cookie 时 dashboard 渲染解锁表单）隐含会堵住读侧，但没有显式说「读也要锁」。A4 实现时是否把列表/详情读也纳入解锁门，方案层面不够明确。

## Issues

### Issue 1: A1 合栈排在 A4 解锁页之前，master 会经历「人类写路径全 401 且无解锁入口」的窗口

- Severity: major
- Section: Phase A / 建议的 PR 切分
- Description: 方案目标是把 master 变成「可发布的 harness-first 工作台」，且 Key Decision 3 自述「解锁页是硬前置」。但 PR 表把 A1（合栈）放在最前、A4（解锁页）放在第四位（A2、A3 两个 docs PR 之后）。栈顶代码里 dashboard 的保存/校对/promote 全部通过浏览器 fetch 打 human API（`components/question/question-editor.tsx:78`、`components/draft/draft-review-workspace.tsx:198/264/302/346`），无 cookie 即 401；而整个 app/、components/ 没有任何解锁 UI。A1 合并后到 A4 落地前，master 上老师能浏览（server components 直读 prisma），但点任何写按钮都失败，且**没有任何界面途径获得 cookie**。若 A2/A3 按表先行，README 还会先于功能宣称「无 cookie → 401」。
- Evidence: `app/api/questions/route.ts` 的 `requireHumanApiAuth`；draft-review-workspace.tsx 的四处 fetch；layout.tsx / nav.tsx 无解锁入口；PR 表顺序 A1→A2→A3→A4。
- Suggestion: 三选一——(a) 把 A4 提前到 A1 之前（先落在栈顶分支，再整体合栈）；(b) 把 A1 与 A4 合成一个发布 PR；(c) 至少把 A4 提到 A2/A3 之前，并在方案中显式承认并限制该中间窗口。推荐 (a) 或 (b)。
- Status: open

### Issue 2: A6 验收标准中「promote 缺知识点 400」与实现不符（应为 422）

- Severity: minor
- Section: Phase A6 / 成功标准
- Description: 方案写「E2E 至少覆盖解锁失败/成功和 promote 缺知识点 400」。实际实现中知识点不存在抛 `QuestionRelationError("Knowledge point not found")`，映射为 **422**；这与 v1 设计文档的 422 约定也一致。照方案写 E2E 会断言错状态码。
- Evidence: `lib/domain/promote-draft.ts:174`（throw QuestionRelationError）、同文件 524–527 行（`mapPromoteApiError` → 422）；v1 方案「knowledgePointIds 必须在 DB 中存在，否则 422」。
- Suggestion: 把 A6 文案改为「promote 缺知识点 422」（400 留给 `validatePublishableQuestion` 类内容校验失败）。
- Status: open

### Issue 3: README 过期句子引用不完整，A3 容易漏扫

- Severity: nit
- Section: 当前真实缺口表 / Phase A3
- Description: 缺口表只引了两句（且为转述而非原文）。实际 README 中至少还有三处同类型过期陈述未被点名：Secrets 表「Those routes are still unauthenticated on this branch」、「That package lands in a later PR」（skill 已在 `skills/physhub/SKILL.md`）、mock 路由段落「Today those routes still run unauthenticated」。A3 若只按方案列的两句改，会留下自相矛盾的 README。
- Evidence: README.md（Setup 第 2 步、Secrets 表、Agent skill 段、Drafts and official questions 段）；skills/physhub/SKILL.md 已存在。
- Suggestion: A3 改为「全文 sweep：以『branch / lands / Today / not yet』为关键词逐句核对 README 与 docs/development.md」，而非按清单替换两句。
- Status: open

## Phase / PR Plan review

- **Phase 分层（A 发布 → B 工作台 → C 检索/分发）合理且与 v1 边界自洽。** C 层的触发条件写法（有使用证据再开）正确避免了把 Meilisearch/MCP 当成 v1 欠债；这也符合「建议做 Meilisearch 不算 v1 失败」的审计前提。
- **NQ-1a（栈顶快进合 master）我支持。** 栈已线性化（pr-0…pr-8 逐层 rebase），17 个 commit 内含 6 个 review-fix commit，再拆 9 个独立 PR 只会制造 rebase 噪音；9 个分支已推 origin，保留了按层审查的入口，快进退合不丢审查能力。NQ-1b 应明确否决。
- **A2 单独成 PR 可行**，但与 A1 同 PR 也无不妥；建议 A2 同时把本方案文件（已在 A2 清单中）与未来本审计文件一并纳入，避免计划文档再次游离于 git 历史之外。
- **PR 依赖表除 A4 位置（见 Issue 1）外合理**：A6 依赖 A4 正确（E2E 要走解锁）；B 系列统一依赖 A6 偏保守但安全；B5 依赖 B1 合理（publish/deprecate 的 UI 与版本化编辑共用正式题详情页）。
- **B1（OQ-6 原地 PATCH + QuestionVersion）设计正确**：schema 已有 `QuestionVersion` 与 `QuestionVersionCreatedBy` 关系（prisma/schema.prisma:73/189/228），「不新开草稿避免双 publicId」「agent 无此工具」与 v1 硬约束一致。
- **B2「组题篮 client state」对 v1.1 够用**；NQ-3 推荐内存态我同意。
- **B5 与 NQ-2 的联动写得清楚**（默认搜索仍含 REVIEWED，对外导出才要 PUBLISHED），没有偷偷改 v1 agent 默认行为，符合「不得削弱 agent 不能 promote」。

## Key Decisions review

1. **先合栈再加功能** — 同意，但执行顺序需按 Issue 1 修正，否则「先合栈」会先把一个对人类不可写的 master 发布出去。
2. **不内嵌模型** — 同意，与 v1 Non-Goals 一致；C 层把 OCR worker 的触发条件写成「扫描件 harness 稳定看不清」是可证伪的好表述。
3. **解锁页是 B 之前的硬前置** — 同意，且应进一步加强为「A1 合栈之前/之内的前置」（见 Issue 1）。
4. **OQ-6 原地版本化编辑** — 同意；两条否决（clone 草稿、agent 改正式题）都符合检索完整性与权限边界。
5. **OQ-2/3/5 维持 v1** — 同意；OQ-2 的收紧条件（必须同时收紧 get 与 export）写明了，没有留半截。
6. **MCP/Meilisearch/OCR 归 C** — 同意，触发条件具体。
