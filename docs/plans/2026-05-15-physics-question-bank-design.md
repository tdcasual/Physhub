# 高中物理 AI 辅助题库后台设计方案

日期：2026-05-15

## 1. 产品定位

本系统是一个面向个人和小团队的云端高中物理题库后台。它不是普通题库，也不是 AI 出题平台，而是一个以已有题目整理为核心的教学资产系统。

核心定位：

```text
图片 / PDF / Markdown / LaTeX / 复制文本
↓
AI 辅助解析、分类、校验
↓
人工校对确认
↓
结构化题目资产
↓
搜索、组题、导出、课时调用、Agent 调用
```

AI 的边界必须清晰：

- AI 可以辅助 OCR 整理、结构识别、知识点判定、题型分类、难度建议、易错点建议、质量检查、相似题检索和自然语言搜索。
- AI 不负责凭空出题，不自动发布题目，不直接修改正式答案，不绕过老师确认。

最终目标是把混乱来源的物理题，转化为可信、可检索、可修改、可渲染、可导出的结构化教学资产。

## 2. 系统总架构

推荐采用“云端后台 + AI 整理 Worker + Agent API”的架构。

```text
Web 后台 UI
↓
Core Backend API
↓
Domain Service 层
↓
AI Worker / Search / Export Worker
↓
PostgreSQL + Object Storage + Search Index
```

推荐技术栈：

- 前端：Next.js、React、TypeScript、CodeMirror 或 Monaco、KaTeX、PDF.js、Canvas 裁图。
- 后端：Next.js API 或 NestJS、Prisma、PostgreSQL。
- 文件存储：Cloudflare R2、S3 或 MinIO。
- 搜索：Meilisearch 起步，后期增加向量索引。
- 队列：Redis + BullMQ。
- AI Worker：Python Worker，负责 OCR、版面分析、公式识别、AI 分类、质量检查和导出辅助。
- Agent 接入：Agent Tool API + MCP Server。

后台 UI 和外部 Agent API 必须共用同一套领域服务，保证权限、审计、状态流和数据一致性。

## 3. 用户与权限

第一版按小团队设计，不做复杂多租户。

角色：

- owner：管理系统、标签、知识点、用户、配置和所有题目资产。
- editor：上传、解析、校对、发布、组题和导出。
- viewer：搜索、预览、使用题目和题组。

第一版不做：

- 多学校多租户；
- 复杂组织架构；
- 付费套餐；
- 公开题库市场；
- 复杂审批流。

Agent 使用独立 API key 和 scope，不直接复用人的登录态。

## 4. 核心数据模型

核心对象分为三组：素材、题目、操作记录。

### 4.1 素材对象

`RawAsset` 表示原始上传文件或文本来源，可能是图片、PDF、Markdown、LaTeX 或 Word 复制文本。RawAsset 必须永久保留，用于追溯和重新解析。

`Asset` 表示正式可引用资源，例如题目配图、裁切图、重绘 SVG、导出 PDF。

### 4.2 题目对象

`QuestionDraft` 表示 AI 或人工录入形成的草稿，允许不完整、不准确。

`Question` 表示正式题目，只保存已经人工确认后的结构化内容。

`QuestionVersion` 保存正式题目的历史版本。

`Suggestion` 保存 AI 对知识点、难度、题型、易错点、质量风险等字段的建议。

`KnowledgePoint` 保存树状知识点体系。

`Tag` 保存非树状标签，例如图像题、实验题、课堂例题、易错题。

正式题目建议字段：

```text
id
type
status
stem_md
options_json
answer_json
solution_md
asset_ids
knowledge_point_ids
primary_knowledge_point_id
secondary_knowledge_point_ids
tag_ids
difficulty
usage
source_raw_asset_id
created_by
reviewed_by
published_at
schema_version
```

### 4.3 操作记录

`ParseJob` 表示一次素材解析任务。

`AgentRun` 表示一次 AI 或 Agent 执行记录，包括输入、输出、模型、置信度、是否被采纳。

`ReviewRecord` 表示人工校对、确认、发布、废弃记录。

`QuestionSet` 表示题组、作业、讲义、试卷的题目集合。

`ExportJob` 表示导出 Markdown、LaTeX、PDF 或 MDX 的任务。

核心原则：

```text
AI 写 Draft / Suggestion
人确认后写 Question
所有过程写 AgentRun / ReviewRecord
正式题目改动写 QuestionVersion
```

## 5. 状态流

系统需要区分素材状态、草稿状态和正式题目状态。

RawAsset 状态：

```text
uploaded
processing
parsed
failed
archived
```

QuestionDraft 状态：

```text
draft
needs_review
rejected
promoted
```

Question 状态：

```text
reviewed
published
deprecated
```

完整流程：

```text
上传图片 / PDF / Markdown / LaTeX / 文本
↓
创建 RawAsset
↓
创建 ParseJob
↓
Worker 执行 OCR / 结构识别 / 初步分类
↓
生成 QuestionDraft
↓
生成 Suggestion
↓
老师进入校对工作台
↓
修正题干、选项、答案、解析、图片
↓
确认知识点、难度、标签、用途
↓
提升为正式 Question
↓
发布或暂存 reviewed
```

AI 解析流程不做成黑盒，应拆成：

1. Extract：识别文本、公式、图片区域。
2. Structure：拆分题干、选项、答案、解析。
3. Normalize：清理 Markdown、修正常见 LaTeX 格式、统一单位写法。
4. Classify：建议题型、章节、知识点、难度、用途、易错点。
5. Quality Check：检查缺答案、选项数量异常、公式疑似损坏、题图未引用等问题。

## 6. 校对工作台

校对工作台是第一版最重要的界面。

推荐三栏布局：

```text
左：原始素材
中：结构化编辑
右：实时预览
```

左栏能力：

- 图片 / PDF 预览；
- 缩放；
- OCR 区域高亮；
- 题图裁切；
- 原始 OCR 文本查看。

中栏能力：

- 题干编辑；
- 选项编辑；
- 答案编辑；
- 解析编辑；
- 图片引用；
- 知识点选择；
- 标签选择；
- 难度和用途确认；
- 状态操作。

右栏能力：

- 网页预览；
- 投屏预览；
- 学生版预览；
- 教师版预览；
- LaTeX 预览。

底部显示：

- AI 建议；
- 置信度；
- 风险提示；
- 原始 OCR 文本；
- 修改差异；
- AgentRun 历史。

发布前必须校验：

- 题干不能为空；
- 选择题必须有选项和答案；
- 答案必须匹配选项；
- 必须确认知识点；
- 必须确认题型；
- 图片引用必须有效；
- LaTeX 基础渲染不能报错。

## 7. AI 整理能力

AI Agent 只做整理型能力。

推荐 Agent：

- Structure Agent：识别题干、选项、答案、解析。
- Knowledge Agent：判断章节、小节、知识点。
- Classification Agent：判断题型、用途、是否图像题、是否实验题。
- Difficulty Agent：给出难度建议和理由。
- Misconception Agent：建议易错点标签。
- Quality Agent：检查缺答案、选项异常、公式疑似错误、图片缺失、条件矛盾。
- Search Agent：把自然语言找题需求转为结构化筛选。
- Similarity Agent：查重、找相似题、找同知识点题。

AI 产生的内容先进入 `Suggestion`：

```yaml
knowledge_points:
  - value: v-t 图像
    confidence: 0.92
    reason: 题干涉及速度-时间图像面积表示位移
difficulty:
  value: 2
  confidence: 0.78
risks:
  - 请确认题干是否为“正确的是”而非“不正确的是”
```

老师确认后才写入正式 `Question.metadata`。

## 8. Agent API 与 MCP 工具

Agent API 是系统的一等能力。后台 UI 给人使用，Agent API / MCP 工具给外部 Agent 使用，两者共享核心服务。

分层：

```text
Core API
Agent Tool API
MCP Server
Webhook / Event API
```

Agent 默认可以：

- 搜索；
- 读取；
- 创建草稿；
- 提交建议；
- 质量检查；
- 查重；
- 创建题组；
- 导出。

Agent 默认不能：

- 发布正式题目；
- 删除正式题目；
- 直接修改正式答案；
- 绕过人工审核。

推荐工具：

```text
search_questions
get_question
get_question_preview
create_question_draft
update_question_draft
submit_question_suggestions
classify_question
check_question_quality
find_similar_questions
create_question_set
recommend_questions_for_lesson
export_question_set
get_job_status
```

接口要求：

- API key / OAuth token；
- scope 权限；
- Idempotency-Key；
- request_id；
- 异步 job_id；
- 结构化 JSON 返回；
- 稳定错误码；
- 审计日志。

推荐 scope：

```text
questions:read
questions:search
drafts:create
drafts:update
suggestions:create
quality:check
similarity:read
question_sets:create
exports:create
```

高风险 scope：

```text
questions:publish
questions:delete
metadata:write
```

第一版不建议给外部 Agent `questions:publish`。

自然语言搜索示例：

```json
{
  "query": "找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图",
  "constraints": {
    "status": ["published"],
    "limit": 3
  }
}
```

返回：

```json
{
  "understanding": {
    "grade": "高一",
    "chapter": "运动学",
    "knowledge_points": ["v-t 图像", "位移"],
    "difficulty": [1, 2],
    "usage": ["随堂练习"],
    "has_image": true
  },
  "results": [
    {
      "question_id": "q_motion_vt_0001",
      "score": 0.94,
      "reason": "直接考查 v-t 图像面积表示位移，含图像，适合随堂练习"
    }
  ]
}
```

## 9. 搜索系统

搜索系统分三层：

```text
结构化筛选
全文搜索
语义搜索 / AI 查询理解
```

结构化筛选字段：

- 年级；
- 章节；
- 小节；
- 知识点；
- 题型；
- 难度；
- 用途；
- 状态；
- 是否有图；
- 是否有解析；
- 是否已发布；
- 来源；
- 创建时间；
- 使用次数。

全文搜索覆盖：

- 题干；
- 选项；
- 解析；
- 标签；
- 来源说明；
- 易错点。

AI 原生搜索负责把自然语言需求转成结构化查询，然后再走正式搜索流程。它不生成题目，只返回已有题目。

排序建议综合：

- 知识点匹配度；
- 题干语义匹配度；
- 难度匹配度；
- 使用场景匹配度；
- 题目质量状态；
- 最近使用情况；
- 是否有图；
- 是否有解析。

外部 Agent 搜索时，结果应包含推荐理由、主考知识点、适用场景和注意事项。

## 10. 知识点体系与标签

知识点采用树状结构：

```text
学科
└── 年级
    └── 章节
        └── 小节
            └── 知识点
```

示例：

```text
物理
└── 高一
    └── 运动学
        └── 速度-时间图像
            ├── 斜率表示加速度
            ├── 面积表示位移
            └── 正负面积与方向
```

题目支持：

- primary_knowledge_point；
- secondary_knowledge_points。

非树状标签用于横向组织：

- 图像题；
- 实验题；
- 选择题；
- 计算题；
- 课堂例题；
- 随堂练习；
- 课后作业；
- 易错题；
- 多过程问题；
- 临界问题。

分类策略：

```text
AI 先建议
老师确认
系统记录采纳率
高频错误反向优化提示词和规则
```

## 11. 渲染与导出

渲染系统应独立设计为 Renderer Service。同一道题只维护一份结构化数据，所有场景都从这份数据渲染。

渲染模式：

- web_preview：后台网页预览。
- classroom：投屏模式，大字号，可隐藏答案和解析。
- student_handout：学生版，只显示题干、选项和作答区域。
- teacher_handout：教师版，显示答案、解析、知识点、易错点、教学提示。
- exam_latex：LaTeX 试卷格式。
- mdx_component：课时系统可引用组件。

MDX 调用：

```mdx
<Question id="q_motion_vt_0001" />
```

支持参数：

```mdx
<Question
  id="q_motion_vt_0001"
  mode="classroom"
  showAnswer={false}
  showSolution={false}
  reveal="step"
/>
```

题组调用：

```mdx
<QuestionGroup
  ids={["q_motion_vt_0001", "q_motion_vt_0002"]}
  mode="student_handout"
  showAnswer={false}
/>
```

导出采用异步任务：

```text
创建 ExportJob
↓
Renderer 生成中间内容
↓
导出 Markdown / LaTeX / PDF / MDX
↓
保存到 Object Storage
↓
返回下载链接或课时引用代码
```

第一版导出优先级：

1. Markdown 学生版 / 教师版；
2. LaTeX 试卷；
3. MDX 课时组件；
4. PDF 讲义。

PDF 可以先通过 HTML 渲染后打印生成，LaTeX PDF 后期增强。

## 12. MVP 里程碑

### MVP 0：基础工程与数据底座

目标：

- Next.js + TypeScript；
- PostgreSQL + Prisma；
- 登录与用户角色；
- 对象存储接入；
- 基础 API 结构；
- 题目 schema；
- RawAsset / Question / QuestionDraft / AgentRun 表。

完成标准：

- 可以登录后台；
- 可以创建一条结构化题目；
- 可以保存 Markdown + LaTeX；
- 可以上传一张原始图片。

### MVP 1：人工录题与预览

目标：

- 题目 CRUD；
- 题干、选项、答案、解析编辑；
- KaTeX 实时预览；
- 知识点和标签选择；
- 题目状态流；
- 题目版本记录。

完成标准：

- 可以手动录入一道完整物理题；
- 可以预览学生版和教师版；
- 可以发布为正式题；
- 可以回看版本历史。

### MVP 2：AI 辅助整理

目标：

- AI 结构识别；
- 知识点建议；
- 题型建议；
- 难度建议；
- 易错点建议；
- 质量检查；
- Suggestion 待确认；
- AgentRun 记录。

完成标准：

- 对已有题目点击“AI 整理”；
- 系统给出分类和风险建议；
- 老师可以采纳或忽略；
- 正式字段只在人确认后更新。

### MVP 3：图片/文本解析草稿

目标：

- 上传图片 / 粘贴文本；
- 创建 ParseJob；
- OCR 或 AI 整理为 QuestionDraft；
- 校对工作台；
- 草稿提升为正式题。

完成标准：

- 上传一道题图；
- 生成草稿；
- 老师修改后发布；
- 原图和 AgentRun 可追溯。

PDF 批量切题先不做，最多支持单页或单题 PDF。

### MVP 4：搜索、组题、导出、Agent API

目标：

- Meilisearch 全文搜索；
- 结构化筛选；
- 自然语言搜索理解；
- 组题篮；
- QuestionSet；
- Markdown / LaTeX / MDX 导出；
- Agent Tool API；
- 基础 MCP Server。

完成标准：

- 可以按知识点找题；
- 可以自然语言找已有题；
- 可以生成题组；
- 可以导出讲义或课时 MDX；
- 外部 Agent 可以调用 search_questions 和 export_question_set。

整体开发顺序：

```text
先人工录题
再 AI 整理
再图片草稿
再搜索组题
最后导出和 MCP
```

## 13. 错误处理

核心原则：

```text
AI 输出可以失败
解析可以失败
导出可以失败
但正式题目不能被静默污染
```

异步任务统一状态：

```text
queued
running
succeeded
failed
canceled
retrying
```

失败记录：

```text
error_code
error_message
raw_error
retry_count
failed_step
input_snapshot
```

如果 OCR 成功但结构识别失败，应保留 OCR 文本，允许老师手动整理。

## 14. 安全策略

安全要求：

- 上传文件限制大小和类型；
- PDF / 图片做基础安全扫描；
- LaTeX 渲染禁止 shell escape；
- HTML / Markdown 渲染做 XSS 清理；
- MDX 导出避免不可信内容变成可执行组件；
- 对象存储使用签名 URL；
- API key 可撤销、可轮换；
- Agent 调用限流；
- 重要操作写审计日志。

## 15. 测试策略

第一版测试重点放在核心资产链路：

- 题目 schema 校验测试；
- Markdown / LaTeX 渲染测试；
- 题目发布规则测试；
- Agent API 权限测试；
- 搜索筛选测试；
- 导出格式快照测试；
- AI Suggestion 不直接覆盖正式字段的测试。

端到端测试覆盖主链路：

```text
登录
创建题目
AI 整理建议
人工采纳
发布题目
搜索题目
加入题组
导出 Markdown / LaTeX
```

AI 相关测试不追求输出完全一致，而要测试结构：

- 返回 JSON schema 正确；
- 置信度字段存在；
- 建议进入 pending_review；
- 正式题目未被自动修改。

## 16. 第一版明确不做

第一版不做：

- AI 自动出题；
- 多学校多租户；
- 复杂审批流；
- 公开题库市场；
- 自动生成完整解析替代原解析；
- 完全自动 PDF 切题；
- 一键完美 OCR 入库；
- 复杂支付和商业化系统。

## 17. 成功标准

第一版成功标准不是 AI 有多强，而是主链路跑通：

```text
上传一道已有题目素材
↓
AI 整理为草稿或建议
↓
老师校对确认
↓
正式入库
↓
可按知识点搜索
↓
可加入题组
↓
可导出讲义 / LaTeX / MDX
↓
外部 Agent 可通过 API 检索和使用
```

系统长期价值来自：

- 题目资产足够规范；
- 老师校对足够顺手；
- AI 建议足够可信；
- 搜索组题足够高效；
- 导出结果足够可用；
- Agent API 足够稳定和可审计。

