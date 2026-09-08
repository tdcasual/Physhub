# Kimi Audit: Project Score @ 13b4c60

| 字段 | 值 |
| --- | --- |
| Auditor | Kimi Code CLI |
| Date | 2026-09-08 |
| HEAD audited | `13b4c604baa47f43c233f3cf453c38e17d99a8e2`（`git rev-parse HEAD`，与预期一致） |
| origin/master | `2359c7b`，落后本地 master 1 个 commit（`git log origin/master..HEAD` 仅含 13b4c60） |
| 复跑验证 | `npm test` = **49 files / 390 passed**（23.7s）；`PLAYWRIGHT_CHROME_CHANNEL=chrome npx playwright test` = **6 passed**（真实 Postgres + 构建产物） |
| Verdict | Conditional Pass |

## Executive Summary

对照 stated v1 边界（harness-first 工作台：无 in-process LLM、无 MCP、无 Meilisearch），HEAD 上的产品闭环是**真实落地且可复跑验证**的：老师解锁 → 按名称勾选知识点 → promote → 列表可见，这条链路有 e2e（`tests/e2e/promote.spec.ts`）且我在本机真实 Postgres 上复跑通过（6/6）。上次审计（2026-09-07）提出的三个问题中，A1/A4 顺序问题已消解（解锁门已落在所有 dashboard 页），但 422/400 文案问题以另一种方式仍存在（见 Issues）。主要扣分项在：(1) origin/master 未同步，「已推到 GitHub」的说法不成立；(2) 无 logout、无 cookie 轮换，解锁限流是无 TRUST_PROXY 时全站共享一个桶的内存实现；(3) 默认 Playwright 路径在本机不可跑，配置注释把它归因为「Ubuntu 26.04 不支持」，实际失败机制是浏览器构建版本错位，注释不精确。结论：Conditional Pass —— v1 边界内功能完整、验证充分，但发布状态（origin 同步）与生产安全细节需要先补齐。

## Score Table

| Dimension | Score 0-10 | Evidence (file:line or command) |
| --- | --- | --- |
| Product completeness vs harness-first v1 | 8 | 导航 Questions/Drafts/New draft/Taxonomy（README.md:50）；上传 UI 已存在（components/raw-asset/raw-asset-upload.tsx，挂进 question-editor.tsx:189 与 draft-review-workspace.tsx:631）；组题篮+导出（question-set-basket.tsx）；正式题 PATCH/发布/废弃（app/api/questions/[id]/route.ts:35）。缺 logout、无版本历史 UI |
| Teacher closed loop (unlock → named KP → promote → list) | 9 | e2e 全链路复跑通过：`PLAYWRIGHT_CHROME_CHANNEL=chrome npx playwright test` 6 passed，含「勾选名为"运动学"的 checkbox → Promote → /questions 列表可见 token」（tests/e2e/promote.spec.ts:35-53）；无 KP 时按钮 disabled 且有提示（draft-review-workspace.tsx:227,538,543-545） |
| Agent/harness path & AI boundary (agent cannot publish) | 9 | agent 携带 key 访问人类路由即 403「Agent cannot publish questions」（lib/auth/human-auth.ts:226-237，app/api/questions/route.ts:75）；agent scope 列表无 publish（lib/auth/agent-auth.ts:6-16）；mock 路由默认关（README 与 `ENABLE_MOCK_* !== "true"` 门一致）；README.md:62 明确「Agent `POST /api/questions` returns 403」 |
| Auth / session / secrets | 7 | cookie = HMAC-SHA256(secret, "physhub_editor.v1")（human-auth.ts:34-38），timingSafeEqual 比较、httpOnly+sameSite=lax+prod secure（editor-session/route.ts:59-66）；解锁限流 5 次/60s → 429（human-auth.ts:14-15, route.ts:21-26）；无 secret 全 fail-closed。扣分：无 logout/轮换、共享密钥可自铸 cookie、非生产环境有 `X-Physhub-Editor-Session` header 后门（human-auth.ts:101-110） |
| Domain correctness (draft JSON KP, promote validation, versions) | 9 | 草稿 KP/标签为 JSON 数组（prisma/schema.prisma:145-146），promote 重查存在性、缺失 → 422（promote-draft.ts:174, 520-526）；内容校验失败 → 400（question-schema.ts:128 → promote-draft.ts:503-505）；PATCH 与状态流转均写 QuestionVersion 快照（official-question.ts:191, 247）；taxonomy 父级成环 → 409（taxonomy-write.ts:73,81,250） |
| Tests (unit + e2e coverage vs claims) | 8 | `npm test` 复跑 **49 files / 390 passed**（声明属实）；e2e 6 个 spec 覆盖 smoke/unlock/promote 全链路并在真实 Postgres 上复跑通过。扣分：默认 bundled Chromium 路径在本机直接失败（缺 `chromium_headless_shell-1223`），必须设 `PLAYWRIGHT_CHROME_CHANNEL=chrome`，「开箱即跑」不成立 |
| Docs vs code | 9 | README/development.md 抽样逐句核对均与代码一致（401 fail-closed、403 agent publish、draft JSON KP、mock fixture 门、`npm run check` 范围）。扣分：playwright.config.ts:30-31 注释把失败归因「Ubuntu 26.04 无法安装 bundled Chromium」，实际机制是 Playwright 1.60 需要的 headless shell build 1223 未安装（缓存里有 1208/1228/1234/1243），且 bundled chromium-1243 完整版二进制可正常启动（`--version` 输出 153.0.8010.12）——归因不精确 |
| Teacher UI usefulness (no cuid, taxonomy tree, basket) | 8 | 列表/详情展示 `publicId`（question-list.tsx:63、official-question-editor.tsx:116），不暴露 cuid；知识点树按层级缩进渲染（taxonomy-admin.tsx 用 `flattenKnowledgePointTree`）；搜索结果与题库列表均有 Add to basket（question-search-panel.tsx:176、question-list.tsx:115）；篮内导出带 publishedOnly 开关（question-set-basket.tsx:154） |
| Accessibility / touch / i18n | 4 | 有部分语义化与 aria（draft-review-workspace.tsx:564/639/728/792 的 aria-labelledby/aria-label、搜索按钮 min-h-11 触控尺寸）；但 `app/layout.tsx:18` 固定 `lang="en"`，而校验消息是中文（「必须确认知识点」）、UI 文案中英混排；无 i18n 框架、无键盘/焦点管理证据 |
| Production / ops readiness (origin sync, rate limit, logout, TRUST_PROXY) | 5 | origin/master 落后 1 commit（13b4c60 未推送）；无 logout 端点/按钮；解锁限流是进程内 `Map`（human-auth.ts:32），多实例不共享、重启清零；无 TRUST_PROXY 时所有客户端共享 `"local"` 桶（human-auth.ts:161-170），任何人 5 次错误即可把 owner 锁在门外 60s；TRUST_PROXY 只在 .env.example:7 提及，README Secrets 表未收 |
| Code quality / maintainability | 8 | 分层干净（route → lib/domain → prisma），错误类型统一映射状态码（mapPromoteApiError / mapOfficialQuestionApiError / mapQuestionSetExportApiError），domain 函数可注入 db 便于单测，390 个单测贴着 domain/UI 组件 |
| **Overall (weighted toward teacher loop + security + verification)** | **8** | 教师闭环与验证证据强（真实复跑通过），安全模型在单人 owner 假设下自洽但有明确短板（无 logout、限流共享桶、密钥即会话），发布卫生差（origin 未同步） |

## Fact-check

| 声称 | 结论 | 证据 |
| --- | --- | --- |
| Local master 是 13b4c60，origin/master 落后 1 个 commit | confirmed | `git rev-parse HEAD` = 13b4c604…；`git log --oneline origin/master..HEAD` 仅 `13b4c60`；`git log HEAD..origin/master` 为空；origin/master = `2359c7b` |
| TaxonomyFields 存在且被 new draft、draft review、official editor 使用 | confirmed | components/taxonomy/taxonomy-fields.tsx 存在；引用点：question-editor.tsx:8,191（/questions/new 编辑器）、draft-review-workspace.tsx:10,660、official-question-editor.tsx:9,128 |
| 无 KP 时 Promote 禁用；API 仍 400 必须确认知识点 | confirmed | UI：`canPromote = canEdit && knowledgePointIds.length > 0`（draft-review-workspace.tsx:227），`disabled={…|| !canPromote}`（:538）+ 提示文案（:543-545）；API：`validatePublishableQuestion` 产出「必须确认知识点」（question-schema.ts:128），`QuestionValidationError → 400`（promote-draft.ts:503-505）；e2e 断言 400 与该文案（promote.spec.ts:30-32），复跑通过 |
| Playwright e2e 含 promote.spec.ts；bundled Chromium 在 Ubuntu 26.04 不受支持 | partially confirmed | tests/e2e/promote.spec.ts 存在且（经 system Chrome）复跑通过；`npx playwright test` 默认路径在本机（Ubuntu 26.04.1）确实失败——但报错是 `Executable doesn't exist at …/chromium_headless_shell-1223/…`（Playwright 1.60.0 需要 build 1223，缓存中只有 1208/1228/1234/1243），而非 OS 支持矩阵问题；bundled chromium-1243 完整版可正常启动。playwright.config.ts:30-31 的归因注释不精确，但「默认路径跑不通、需 `PLAYWRIGHT_CHROME_CHANNEL=chrome`」这一操作结论属实 |
| 搜索可加篮；export publishedOnly 默认 false，true → 400 | confirmed | 搜索结果行有「Add to basket」（question-search-panel.tsx:164-176）；`parseExportBody(undefined)` 默认 `{publishedOnly: false}`（question-set-export.ts:54-57）；`publishedOnly=true` 且含非 PUBLISHED → 抛 `QuestionSetExportValidationError` → 400（question-set-export.ts:103-110, 143-145；单测 export-question-set.test.ts:367） |
| Taxonomy 父级成环 → 409 | confirmed | taxonomy-write.ts:73,81 抛 `TaxonomyConflictError("Knowledge point parent cycle")`，:250 映射 409；单测 taxonomy-write.test.ts:96「returns 409 when a knowledge point parent change would cycle」 |
| npm test 是 49 files / 390 passed | confirmed（本次复跑） | `npm test` 输出 `Test Files 49 passed (49)` / `Tests 390 passed (390)`，23.72s |
| 无 logout；cookie 是共享 EDITOR_SESSION_SECRET 的 HMAC | confirmed | `grep -rn "logout\|signout" app/ components/ lib/`（排除测试）零命中；editor-session 路由只有 POST 无 DELETE；cookie 值 = `createHmac("sha256", secret).update("physhub_editor.v1")`（human-auth.ts:34-38） |
| 无 TRUST_PROXY 时 getConnectingIp 返回 "local" | confirmed | human-auth.ts:142-170：仅当 `TRUST_PROXY === "true"` 才读 x-forwarded-for/x-real-ip，否则落入 `return LOCAL_CONNECTING_IP`（:170）；注释（:161）明说 production 无 TRUST_PROXY 时共享一个 local 桶 |
| html lang=en | confirmed | app/layout.tsx:18 `<html lang="en">` |

## Doubts

1. **Question:** playwright.config.ts 注释所称「Ubuntu 26.04 cannot install Playwright's bundled Chromium」是否成立？
   **Files inspected:** playwright.config.ts、`ls ~/.cache/ms-playwright`、`npx playwright --version`（1.60.0）、实测 `npx playwright test`
   **What remains unclear:** 本机默认路径失败的直接原因是 headless shell build 1223 未下载（缓存里其他 build 存在且完整版 chromium-1243 可启动），更像版本错位/未重装，而非 OS 不支持。我没有执行 `npx playwright install`（会向仓库外写入约 150MB，超出只读审计范围），无法最终判定「装不上」。操作结论（需设 `PLAYWRIGHT_CHROME_CHANNEL=chrome`）不受影响。

2. **Question:** 生产部署形态（单实例还是多实例）？
   **Files inspected:** lib/auth/human-auth.ts（内存限流 Map）、README、docs/development.md
   **What remains unclear:** 仓库无任何部署配置（无 Dockerfile/compose/fly.toml 等）。内存限流与「共享 local 桶」的危害取决于实例数与是否有反代，仓库内无法闭合。若 v1 边界就是「单 owner 单机」，当前实现可接受；文档未写明这一假设。

3. **Question:** `X-Physhub-Editor-Session` 非生产 header 后门是否有意保留给 e2e/本地 harness？
   **Files inspected:** human-auth.ts:101-110、tests/unit/helpers/editor-session.ts
   **What remains unclear:** 它被 `NODE_ENV !== "production"` 门住且被测试 helper 使用，大概率是有意的开发通道；但 README Secrets 表没有记录它，运维者不知道非生产环境存在第二条会话获取路径。

## Issues

### Issue 1: origin/master 未同步，「Phase D 已推到 GitHub」不成立

- Severity: major
- File: git 状态（非文件）
- Description: HEAD `13b4c60`（close teacher promote loop with named taxonomy fields）只在本地；origin/master 停在 `2359c7b`。`gh pr list --state all` 为空，也无 PR 渠道。任何以 origin 为准的部署/评审都会漏掉 promote 闭环这个核心 commit。
- Evidence: `git log origin/master..HEAD` = 仅 13b4c60；`gh pr list --state all` 输出为空。
- Suggestion: `git push origin master`；把「推送」纳入发布验收清单。
- Status: open

### Issue 2: 无 logout，cookie 无轮换途径

- Severity: minor
- File: app/api/auth/editor-session/route.ts、lib/auth/human-auth.ts、components/nav.tsx
- Description: 编辑器会话只有发放（POST）没有撤销；cookie 无 maxAge/expires（浏览器会话期存活），nav 无退出按钮。唯一失效方式是轮换 `EDITOR_SESSION_SECRET` 并重启。对「单人 owner」假设可容忍，但公共/共享机器上无法主动退出。
- Evidence: 全仓 grep logout/signout 零命中；route.ts:59-66 的 `cookies.set` 无 maxAge。
- Suggestion: 加 `DELETE /api/auth/editor-session`（清 cookie）+ nav 退出按钮；或给 cookie 设显式 maxAge。
- Status: open

### Issue 3: 无 TRUST_PROXY 时解锁限流退化为全站共享桶，可被陌生人持续锁死 owner

- Severity: minor
- File: lib/auth/human-auth.ts:142-170, 191-214
- Description: 不读代理头时所有客户端计入 `"local"` 一个桶；任何人连续 5 次错误解锁即触发 429，owner 本人也被锁 60s，攻击者可持续续杯。限流还是进程内 Map，多实例部署时每个实例各算各的（限流变松）且重启清零。
- Evidence: human-auth.ts:16（`LOCAL_CONNECTING_IP`）、:161 注释、:32（`new Map`）、:191-198（`count >= 5 → 429`）。
- Suggestion: README/部署文档显式声明「单实例 + 可选 TRUST_PROXY」假设；或对 429 的本地桶给 owner 一条带外恢复路径（如 CLI 重置）。
- Status: open

### Issue 4: playwright.config.ts 对 Chromium 失败的归因不精确

- Severity: minor
- File: playwright.config.ts:30-31
- Description: 注释写「Ubuntu 26.04 cannot install Playwright's bundled Chromium」，但实测失败信息是 `Executable doesn't exist at …/chromium_headless_shell-1223/…`——Playwright 1.60 对应的 build 未安装（缓存里有 4 个其他 build），且 bundled chromium-1243 完整版可正常运行。归因错误会误导后来者放弃 `npx playwright install` 这条可能可行的路。
- Evidence: 本机 `npx playwright test` 报错文本；`~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --version` 输出 `Google Chrome for Testing 153.0.8010.12`；`npx playwright --version` = 1.60.0。
- Suggestion: 注释改为描述实际机制（build 版本错位/未安装），并写明验证过的 workaround：`PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e`（本次复跑 6 passed）。
- Status: open

### Issue 5: html lang="en" 与中文校验文案/中英混排 UI 不匹配

- Severity: nit
- File: app/layout.tsx:18
- Description: 页面声明英文，但 promote 校验返回中文（question-schema.ts:120-136），UI 文案中英混排。屏幕阅读器会按英文规则朗读中文内容；也无任何 i18n 分层。
- Evidence: layout.tsx:18；question-schema.ts:128「必须确认知识点」。
- Suggestion: 若目标用户是中文老师，改 `lang="zh-CN"` 并把 UI 文案统一为中文；至少在含中文的容器上标 `lang`。
- Status: open

### Issue 6: TRUST_PROXY 与非生产 header 后门未进 README Secrets 表

- Severity: nit
- File: README.md Secrets 表、.env.example:7、lib/auth/human-auth.ts:101-110
- Description: `TRUST_PROXY` 只在 .env.example 注释里出现；`X-Physhub-Editor-Session` 开发通道完全无文档。运维者无法从 README 得知这两个影响安全语义的开关。
- Evidence: `grep -n TRUST_PROXY README.md docs/development.md` 零命中（仅 .env.example:7）。
- Suggestion: README Secrets/部署段各加一行说明。
- Status: open

## 与「Phase D fully shipped to GitHub」朴素叙事的分歧

1. **「shipped to GitHub」字面不成立。** 核心 commit 13b4c60 未推送到 origin（Issue 1）；以 origin/master 为准的任何人看到的都是一个没有 named-KP promote 闭环的树。「代码写好」与「已发布到 GitHub」之间差一次 push。
2. **「e2e 通过」需要限定条件。** 6 个 e2e 确实在本机真实 Postgres + 构建产物上全绿，但仅在设了 `PLAYWRIGHT_CHROME_CHANNEL=chrome` 之后；默认命令在本机直接失败。不带限定地说「e2e 全过」会掩盖新机器/CI 上的复现门槛。
3. **「教师闭环完成」不等于「会话管理完成」。** 闭环的写路径（unlock → promote）完整，但会话的另一半（logout、轮换、限流语义在部署形态下的行为）仍是单人本地假设下的最小实现（Issues 2/3）。
4. **文档与代码的一致性是真实的，但配置注释里有一处未经验证的归因**（Issue 4），说明「docs 已对齐」的 sweep 没有覆盖到 playwright.config.ts 这类代码内注释。
