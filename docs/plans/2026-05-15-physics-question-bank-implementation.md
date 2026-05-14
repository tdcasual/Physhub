# Physics Question Bank Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first cloud MVP of a small-team high-school physics question bank backend where AI assists with organization, classification, quality checks, and agent-friendly search, but never creates or publishes final questions without human review.

**Architecture:** Create a Next.js + TypeScript application with PostgreSQL/Prisma as the system of record, local object-storage abstraction for development, Markdown + LaTeX question editing, AI suggestion records, search-ready data models, and agent-safe API routes. Heavy OCR/PDF/AI worker execution is stubbed behind service interfaces in this MVP so the app can be expanded to Redis/BullMQ and Python workers later without changing core domain models.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, React, Tailwind CSS, KaTeX, Zod, Vitest, Playwright, future Meilisearch, future Redis/BullMQ, future Python AI Worker, future MCP Server.

---

## Ground Rules

- This repository currently only contains planning docs. Start by creating the app from scratch in the existing workspace.
- Keep AI behavior bounded: AI may create drafts and suggestions; it must not publish questions, delete questions, or overwrite confirmed metadata.
- Prefer small commits after each task. If the workspace is not a git repository, initialize git in Task 1 before committing.
- Use TDD where practical. For UI-heavy steps, use component tests or Playwright smoke tests once the app shell exists.
- Use local filesystem storage for development uploads first. Keep the storage service interface compatible with later S3/R2.
- Keep PDF/OCR/AI model integrations behind interfaces and mocked implementations in MVP 0-3.

## Target Directory Structure

```text
.
├── app/
│   ├── (dashboard)/
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── domain/
│   ├── renderer/
│   ├── search/
│   ├── storage/
│   └── workers/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
│   └── plans/
├── public/
└── uploads/
```

## Phase 0: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize git if needed**

Run:

```bash
git rev-parse --is-inside-work-tree || git init
```

Expected: either `true` or a new git repository initialized.

**Step 2: Create the project files**

Use `npm create next-app@latest .` with:

```text
TypeScript: yes
ESLint: yes
Tailwind: yes
src directory: no
App Router: yes
Turbopack: yes
import alias: @/*
```

If the command refuses because the directory is not empty, create the files manually or initialize in a temporary directory and copy the generated project files into this workspace without deleting `docs/`.

**Step 3: Install baseline dependencies**

Run:

```bash
npm install zod katex react-markdown remark-math rehype-katex rehype-sanitize clsx lucide-react
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom playwright @playwright/test
```

Expected: dependencies installed.

**Step 4: Add environment example**

`.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/physics_question_bank?schema=public"
APP_BASE_URL="http://localhost:3000"
LOCAL_UPLOAD_DIR="./uploads"
AGENT_API_KEY_DEV="dev-agent-key"
```

**Step 5: Verify app starts**

Run:

```bash
npm run lint
npm run dev
```

Expected: lint passes, dev server starts at `http://localhost:3000`.

**Step 6: Commit**

```bash
git add .
git commit -m "chore: initialize next app"
```

### Task 2: Add Testing Harness

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/unit/smoke.test.ts`
- Modify: `package.json`

**Step 1: Add Vitest config**

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

**Step 2: Add test setup**

`tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

**Step 3: Add smoke test**

`tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs unit tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 4: Add scripts**

Modify `package.json` scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

**Step 5: Run tests**

Run:

```bash
npm test
```

Expected: smoke test passes.

**Step 6: Commit**

```bash
git add package.json vitest.config.ts tests
git commit -m "test: add vitest harness"
```

### Task 3: Configure Prisma and Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: Install Prisma**

Run:

```bash
npm install @prisma/client
npm install -D prisma tsx
```

**Step 2: Write Prisma schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  OWNER
  EDITOR
  VIEWER
}

enum RawAssetKind {
  IMAGE
  PDF
  MARKDOWN
  LATEX
  TEXT
}

enum RawAssetStatus {
  UPLOADED
  PROCESSING
  PARSED
  FAILED
  ARCHIVED
}

enum DraftStatus {
  DRAFT
  NEEDS_REVIEW
  REJECTED
  PROMOTED
}

enum QuestionStatus {
  REVIEWED
  PUBLISHED
  DEPRECATED
}

enum QuestionType {
  SINGLE_CHOICE
  MULTIPLE_CHOICE
  FILL_BLANK
  EXPERIMENT
  CALCULATION
  PROOF
  IMAGE_ANALYSIS
}

enum JobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
  CANCELED
  RETRYING
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      UserRole @default(EDITOR)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  createdQuestions Question[] @relation("QuestionCreatedBy")
  reviewedQuestions Question[] @relation("QuestionReviewedBy")
}

model RawAsset {
  id           String         @id @default(cuid())
  kind         RawAssetKind
  status       RawAssetStatus @default(UPLOADED)
  originalName String
  mimeType     String?
  storageKey   String?
  textContent  String?
  metadata     Json?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  parseJobs ParseJob[]
  drafts    QuestionDraft[]
  questions Question[]
}

model Asset {
  id          String   @id @default(cuid())
  kind        String
  format      String
  storageKey  String
  title       String?
  metadata    Json?
  derivedFrom String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  questionAssets QuestionAsset[]
}

model KnowledgePoint {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  parentId  String?
  sortOrder Int      @default(0)
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent   KnowledgePoint?  @relation("KnowledgeTree", fields: [parentId], references: [id])
  children KnowledgePoint[] @relation("KnowledgeTree")

  primaryQuestions   Question[]                 @relation("PrimaryKnowledgePoint")
  questionLinks      QuestionKnowledgePoint[]
  draftSuggestions   Suggestion[]
}

model Tag {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  group     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  questions QuestionTag[]
}

model QuestionDraft {
  id              String      @id @default(cuid())
  status          DraftStatus @default(DRAFT)
  type            QuestionType?
  stemMd          String?
  optionsJson     Json?
  answerJson      Json?
  solutionMd      String?
  sourceRawAssetId String?
  aiOutput        Json?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  promotedAt      DateTime?

  sourceRawAsset RawAsset? @relation(fields: [sourceRawAssetId], references: [id])
  suggestions    Suggestion[]
  agentRuns      AgentRun[]
}

model Question {
  id                      String         @id @default(cuid())
  publicId                String         @unique
  type                    QuestionType
  status                  QuestionStatus @default(REVIEWED)
  stemMd                  String
  optionsJson             Json?
  answerJson              Json
  solutionMd              String?
  difficulty              Int?
  usageJson               Json?
  metadata                Json?
  sourceRawAssetId        String?
  primaryKnowledgePointId String?
  schemaVersion           Int            @default(1)
  createdById             String?
  reviewedById            String?
  publishedAt             DateTime?
  createdAt               DateTime       @default(now())
  updatedAt               DateTime       @updatedAt

  sourceRawAsset        RawAsset?       @relation(fields: [sourceRawAssetId], references: [id])
  primaryKnowledgePoint KnowledgePoint? @relation("PrimaryKnowledgePoint", fields: [primaryKnowledgePointId], references: [id])
  createdBy             User?          @relation("QuestionCreatedBy", fields: [createdById], references: [id])
  reviewedBy            User?          @relation("QuestionReviewedBy", fields: [reviewedById], references: [id])

  knowledgePoints QuestionKnowledgePoint[]
  tags            QuestionTag[]
  assets          QuestionAsset[]
  versions        QuestionVersion[]
  suggestions     Suggestion[]
  setItems        QuestionSetItem[]
}

model QuestionKnowledgePoint {
  questionId       String
  knowledgePointId String
  role             String @default("secondary")

  question       Question       @relation(fields: [questionId], references: [id], onDelete: Cascade)
  knowledgePoint KnowledgePoint @relation(fields: [knowledgePointId], references: [id], onDelete: Cascade)

  @@id([questionId, knowledgePointId])
}

model QuestionTag {
  questionId String
  tagId      String

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([questionId, tagId])
}

model QuestionAsset {
  questionId String
  assetId    String
  role       String @default("figure")
  sortOrder  Int    @default(0)

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  asset    Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@id([questionId, assetId])
}

model QuestionVersion {
  id         String   @id @default(cuid())
  questionId String
  version    Int
  snapshot   Json
  createdBy  String?
  createdAt  DateTime @default(now())

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([questionId, version])
}

model Suggestion {
  id               String   @id @default(cuid())
  questionId       String?
  draftId          String?
  kind             String
  payload          Json
  confidence       Float?
  status           String   @default("pending_review")
  createdByAgentRunId String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  question Question?      @relation(fields: [questionId], references: [id], onDelete: Cascade)
  draft    QuestionDraft? @relation(fields: [draftId], references: [id], onDelete: Cascade)
  knowledgePoint KnowledgePoint? @relation(fields: [knowledgePointId], references: [id])
  knowledgePointId String?
}

model ParseJob {
  id          String    @id @default(cuid())
  rawAssetId  String
  status      JobStatus @default(QUEUED)
  jobType     String
  input       Json?
  output      Json?
  errorCode   String?
  errorMessage String?
  rawError    String?
  retryCount  Int       @default(0)
  failedStep  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  rawAsset RawAsset @relation(fields: [rawAssetId], references: [id], onDelete: Cascade)
}

model AgentRun {
  id          String    @id @default(cuid())
  agentName   String
  toolName    String?
  model       String?
  status      JobStatus @default(SUCCEEDED)
  input       Json
  output      Json?
  confidence  Float?
  accepted    Boolean?
  draftId     String?
  createdAt   DateTime  @default(now())

  draft QuestionDraft? @relation(fields: [draftId], references: [id], onDelete: SetNull)
}

model ReviewRecord {
  id           String   @id @default(cuid())
  resourceType String
  resourceId   String
  action       String
  actorId      String?
  notes        String?
  diff         Json?
  createdAt    DateTime @default(now())
}

model QuestionSet {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      String   @default("draft")
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items      QuestionSetItem[]
  exportJobs ExportJob[]
}

model QuestionSetItem {
  id            String @id @default(cuid())
  questionSetId String
  questionId    String
  sortOrder     Int
  points        Float?
  settings      Json?

  questionSet QuestionSet @relation(fields: [questionSetId], references: [id], onDelete: Cascade)
  question    Question    @relation(fields: [questionId], references: [id])

  @@unique([questionSetId, questionId])
}

model ExportJob {
  id            String    @id @default(cuid())
  questionSetId String?
  format        String
  status        JobStatus @default(QUEUED)
  outputKey     String?
  errorCode     String?
  errorMessage  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  questionSet QuestionSet? @relation(fields: [questionSetId], references: [id], onDelete: SetNull)
}

model ApiKey {
  id          String   @id @default(cuid())
  name        String
  keyHash     String   @unique
  scopes      String[]
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime @default(now())
}
```

**Step 3: Add Prisma singleton**

`lib/db/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Step 4: Add scripts**

`package.json`:

```json
{
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:seed": "tsx prisma/seed.ts",
  "db:studio": "prisma studio"
}
```

**Step 5: Write failing schema smoke test**

Create `tests/unit/schema-enums.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { QuestionStatus, QuestionType } from "@prisma/client";

describe("Prisma generated enums", () => {
  it("contains required question states and types", () => {
    expect(QuestionStatus.PUBLISHED).toBe("PUBLISHED");
    expect(QuestionType.SINGLE_CHOICE).toBe("SINGLE_CHOICE");
  });
});
```

**Step 6: Generate Prisma client**

Run:

```bash
npm run db:generate
npm test -- tests/unit/schema-enums.test.ts
```

Expected: test passes.

**Step 7: Commit**

```bash
git add prisma lib/db package.json tests/unit/schema-enums.test.ts
git commit -m "feat: add prisma domain schema"
```

## Phase 1: Domain Validation and Rendering Core

### Task 4: Define Question Domain Schemas

**Files:**
- Create: `lib/domain/question-schema.ts`
- Create: `tests/unit/question-schema.test.ts`

**Step 1: Write failing validation tests**

`tests/unit/question-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { questionInputSchema, validatePublishableQuestion } from "@/lib/domain/question-schema";

describe("question schema", () => {
  it("accepts a valid single choice question", () => {
    const result = questionInputSchema.safeParse({
      type: "SINGLE_CHOICE",
      stemMd: "如图所示，$v-t$ 图像面积表示什么？",
      options: [
        { label: "A", value: "速度" },
        { label: "B", value: "位移" },
      ],
      answer: { type: "single", value: "B" },
      solutionMd: "面积表示位移。",
      difficulty: 2,
      knowledgePointIds: ["kp_1"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects publish when answer does not match options", () => {
    const errors = validatePublishableQuestion({
      type: "SINGLE_CHOICE",
      stemMd: "题干",
      options: [{ label: "A", value: "选项" }],
      answer: { type: "single", value: "B" },
      knowledgePointIds: ["kp_1"],
    });

    expect(errors).toContain("答案必须匹配选项");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/question-schema.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Implement schema**

`lib/domain/question-schema.ts`:

```ts
import { z } from "zod";

export const optionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single"), value: z.string().min(1) }),
  z.object({ type: z.literal("multiple"), value: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("text"), value: z.string().min(1) }),
]);

export const questionInputSchema = z.object({
  type: z.enum([
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "FILL_BLANK",
    "EXPERIMENT",
    "CALCULATION",
    "PROOF",
    "IMAGE_ANALYSIS",
  ]),
  stemMd: z.string().min(1),
  options: z.array(optionSchema).optional(),
  answer: answerSchema,
  solutionMd: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  knowledgePointIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

export function validatePublishableQuestion(input: Partial<QuestionInput>): string[] {
  const errors: string[] = [];

  if (!input.stemMd?.trim()) errors.push("题干不能为空");
  if (!input.type) errors.push("必须确认题型");
  if (!input.answer) errors.push("必须填写答案");
  if (!input.knowledgePointIds?.length) errors.push("必须确认知识点");

  if (input.type === "SINGLE_CHOICE" || input.type === "MULTIPLE_CHOICE") {
    if (!input.options?.length) {
      errors.push("选择题必须有选项");
    }

    const labels = new Set(input.options?.map((option) => option.label) ?? []);
    if (input.answer?.type === "single" && !labels.has(input.answer.value)) {
      errors.push("答案必须匹配选项");
    }
    if (input.answer?.type === "multiple") {
      for (const value of input.answer.value) {
        if (!labels.has(value)) errors.push("答案必须匹配选项");
      }
    }
  }

  return [...new Set(errors)];
}
```

**Step 4: Run tests**

Run:

```bash
npm test -- tests/unit/question-schema.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/domain/question-schema.ts tests/unit/question-schema.test.ts
git commit -m "feat: add question validation schema"
```

### Task 5: Add Markdown and LaTeX Renderer

**Files:**
- Create: `lib/renderer/render-markdown.tsx`
- Create: `components/question/question-preview.tsx`
- Create: `tests/unit/render-markdown.test.tsx`
- Modify: `app/globals.css`

**Step 1: Write failing renderer test**

`tests/unit/render-markdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownLatex } from "@/lib/renderer/render-markdown";

describe("MarkdownLatex", () => {
  it("renders markdown text and latex content", () => {
    render(<MarkdownLatex content={"速度公式 $v=v_0+at$"} />);
    expect(screen.getByText(/速度公式/)).toBeInTheDocument();
    expect(document.querySelector(".katex")).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/render-markdown.test.tsx
```

Expected: FAIL because module does not exist.

**Step 3: Implement renderer**

`lib/renderer/render-markdown.tsx`:

```tsx
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import remarkMath from "remark-math";

export function MarkdownLatex({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeSanitize]}
      components={{
        img: ({ src = "", alt = "" }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="max-w-full rounded border border-slate-200" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

`components/question/question-preview.tsx`:

```tsx
import { MarkdownLatex } from "@/lib/renderer/render-markdown";

type Option = { label: string; value: string };

export function QuestionPreview({
  stemMd,
  options = [],
  solutionMd,
  showSolution = false,
}: {
  stemMd: string;
  options?: Option[];
  solutionMd?: string | null;
  showSolution?: boolean;
}) {
  return (
    <article className="space-y-4 rounded border border-slate-200 bg-white p-4">
      <div className="prose prose-slate max-w-none">
        <MarkdownLatex content={stemMd} />
      </div>
      {options.length > 0 ? (
        <div className="grid gap-2">
          {options.map((option) => (
            <div key={option.label} className="flex gap-2">
              <span className="font-semibold">{option.label}.</span>
              <div className="prose prose-slate max-w-none">
                <MarkdownLatex content={option.value} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {showSolution && solutionMd ? (
        <section className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-700">解析</h3>
          <div className="prose prose-slate max-w-none">
            <MarkdownLatex content={solutionMd} />
          </div>
        </section>
      ) : null}
    </article>
  );
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/render-markdown.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/renderer components/question tests/unit/render-markdown.test.tsx app/globals.css
git commit -m "feat: render markdown latex questions"
```

## Phase 2: CRUD API and Manual Question Entry

### Task 6: Add Question Service

**Files:**
- Create: `lib/domain/question-service.ts`
- Create: `tests/unit/question-service.test.ts`

**Step 1: Write failing service tests**

`tests/unit/question-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPublicQuestionId, normalizeQuestionInput } from "@/lib/domain/question-service";

describe("question service helpers", () => {
  it("builds stable public question ids", () => {
    expect(buildPublicQuestionId("motion", 1)).toBe("q_motion_0001");
  });

  it("normalizes option labels", () => {
    const input = normalizeQuestionInput({
      type: "SINGLE_CHOICE",
      stemMd: "题干",
      options: [
        { label: "a", value: "甲" },
        { label: " b ", value: "乙" },
      ],
      answer: { type: "single", value: "B" },
      knowledgePointIds: ["kp"],
    });

    expect(input.options?.map((option) => option.label)).toEqual(["A", "B"]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/question-service.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Implement helpers**

`lib/domain/question-service.ts`:

```ts
import type { QuestionInput } from "./question-schema";

export function buildPublicQuestionId(topicSlug: string, sequence: number) {
  return `q_${topicSlug}_${String(sequence).padStart(4, "0")}`;
}

export function normalizeQuestionInput(input: QuestionInput): QuestionInput {
  return {
    ...input,
    stemMd: input.stemMd.trim(),
    solutionMd: input.solutionMd?.trim(),
    options: input.options?.map((option) => ({
      label: option.label.trim().toUpperCase(),
      value: option.value.trim(),
    })),
  };
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/question-service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/domain/question-service.ts tests/unit/question-service.test.ts
git commit -m "feat: add question service helpers"
```

### Task 7: Add Question API Routes

**Files:**
- Create: `app/api/questions/route.ts`
- Create: `app/api/questions/[id]/route.ts`
- Create: `lib/domain/question-repository.ts`
- Create: `tests/unit/question-api-contract.test.ts`

**Step 1: Write route contract tests**

`tests/unit/question-api-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validatePublishableQuestion } from "@/lib/domain/question-schema";

describe("question API contract", () => {
  it("requires publishable fields before published status", () => {
    expect(
      validatePublishableQuestion({
        type: "SINGLE_CHOICE",
        stemMd: "",
        answer: { type: "single", value: "A" },
        knowledgePointIds: [],
      }),
    ).toEqual(expect.arrayContaining(["题干不能为空", "必须确认知识点", "选择题必须有选项"]));
  });
});
```

**Step 2: Implement repository**

`lib/domain/question-repository.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { normalizeQuestionInput } from "./question-service";
import { questionInputSchema, validatePublishableQuestion } from "./question-schema";

export async function listQuestions() {
  return prisma.question.findMany({
    orderBy: { updatedAt: "desc" },
    include: { primaryKnowledgePoint: true, tags: { include: { tag: true } } },
  });
}

export async function getQuestion(id: string) {
  return prisma.question.findUnique({
    where: { id },
    include: {
      primaryKnowledgePoint: true,
      knowledgePoints: { include: { knowledgePoint: true } },
      tags: { include: { tag: true } },
      assets: { include: { asset: true } },
    },
  });
}

export async function createQuestion(rawInput: unknown) {
  const parsed = questionInputSchema.parse(rawInput);
  const input = normalizeQuestionInput(parsed);
  const errors = validatePublishableQuestion(input);

  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  const count = await prisma.question.count();

  return prisma.question.create({
    data: {
      publicId: `q_manual_${String(count + 1).padStart(4, "0")}`,
      type: input.type,
      stemMd: input.stemMd,
      optionsJson: input.options ?? undefined,
      answerJson: input.answer,
      solutionMd: input.solutionMd,
      difficulty: input.difficulty,
      status: "REVIEWED",
      knowledgePoints: {
        create: input.knowledgePointIds.map((knowledgePointId, index) => ({
          knowledgePointId,
          role: index === 0 ? "primary" : "secondary",
        })),
      },
      primaryKnowledgePointId: input.knowledgePointIds[0],
    },
  });
}
```

**Step 3: Implement API routes**

`app/api/questions/route.ts`:

```ts
import { createQuestion, listQuestions } from "@/lib/domain/question-repository";
import { NextResponse } from "next/server";

export async function GET() {
  const questions = await listQuestions();
  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = await createQuestion(body);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
```

`app/api/questions/[id]/route.ts`:

```ts
import { getQuestion } from "@/lib/domain/question-repository";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await getQuestion(id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({ question });
}
```

**Step 4: Run unit tests**

```bash
npm test -- tests/unit/question-api-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/questions lib/domain/question-repository.ts tests/unit/question-api-contract.test.ts
git commit -m "feat: add question api routes"
```

### Task 8: Build Manual Question Editor Page

**Files:**
- Create: `app/(dashboard)/questions/new/page.tsx`
- Create: `components/question/question-editor.tsx`
- Create: `components/question/option-editor.tsx`
- Create: `components/question/answer-editor.tsx`
- Modify: `app/page.tsx`

**Step 1: Create editor component**

`components/question/question-editor.tsx`:

```tsx
"use client";

import { QuestionPreview } from "./question-preview";
import { useMemo, useState } from "react";

type Option = { label: string; value: string };

export function QuestionEditor() {
  const [stemMd, setStemMd] = useState("如图所示，$v-t$ 图像面积表示什么？");
  const [options, setOptions] = useState<Option[]>([
    { label: "A", value: "速度" },
    { label: "B", value: "位移" },
  ]);
  const [answer, setAnswer] = useState("B");
  const [solutionMd, setSolutionMd] = useState("面积表示位移。");
  const payload = useMemo(
    () => ({
      type: "SINGLE_CHOICE",
      stemMd,
      options,
      answer: { type: "single", value: answer },
      solutionMd,
      knowledgePointIds: [],
    }),
    [answer, options, solutionMd, stemMd],
  );

  return (
    <div className="grid min-h-screen grid-cols-1 gap-4 bg-slate-100 p-4 lg:grid-cols-2">
      <section className="space-y-4 rounded border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold">新建题目</h1>
        <label className="grid gap-1">
          <span className="text-sm font-medium">题干</span>
          <textarea className="min-h-32 rounded border p-2 font-mono" value={stemMd} onChange={(event) => setStemMd(event.target.value)} />
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-medium">选项</span>
          {options.map((option, index) => (
            <div key={option.label} className="grid grid-cols-[3rem_1fr] gap-2">
              <input className="rounded border p-2" value={option.label} onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, label: event.target.value };
                setOptions(next);
              }} />
              <input className="rounded border p-2" value={option.value} onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, value: event.target.value };
                setOptions(next);
              }} />
            </div>
          ))}
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-medium">答案</span>
          <input className="rounded border p-2" value={answer} onChange={(event) => setAnswer(event.target.value)} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">解析</span>
          <textarea className="min-h-32 rounded border p-2 font-mono" value={solutionMd} onChange={(event) => setSolutionMd(event.target.value)} />
        </label>
        <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(payload, null, 2)}</pre>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">实时预览</h2>
        <QuestionPreview stemMd={stemMd} options={options} solutionMd={solutionMd} showSolution />
      </section>
    </div>
  );
}
```

**Step 2: Add page**

`app/(dashboard)/questions/new/page.tsx`:

```tsx
import { QuestionEditor } from "@/components/question/question-editor";

export default function NewQuestionPage() {
  return <QuestionEditor />;
}
```

**Step 3: Update home page**

`app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold">高中物理题库后台</h1>
        <p className="text-slate-600">AI 辅助整理、分类、校验和检索，不自动出题。</p>
        <Link className="inline-flex rounded bg-slate-900 px-4 py-2 text-white" href="/questions/new">
          新建题目
        </Link>
      </div>
    </main>
  );
}
```

**Step 4: Run lint and manual smoke**

```bash
npm run lint
npm run dev
```

Open `http://localhost:3000/questions/new`.

Expected: editor and preview render; LaTeX displays through KaTeX.

**Step 5: Commit**

```bash
git add app components/question
git commit -m "feat: add manual question editor"
```

## Phase 3: Knowledge Points, Tags, and Seed Data

### Task 9: Add Seed Data

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

**Step 1: Write seed script**

`prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const physics = await prisma.knowledgePoint.upsert({
    where: { slug: "physics" },
    update: {},
    create: { name: "物理", slug: "physics" },
  });

  const gradeOne = await prisma.knowledgePoint.upsert({
    where: { slug: "physics-grade-1" },
    update: {},
    create: { name: "高一", slug: "physics-grade-1", parentId: physics.id },
  });

  const motion = await prisma.knowledgePoint.upsert({
    where: { slug: "motion" },
    update: {},
    create: { name: "运动学", slug: "motion", parentId: gradeOne.id },
  });

  await prisma.knowledgePoint.upsert({
    where: { slug: "vt-area-displacement" },
    update: {},
    create: { name: "v-t 图像面积表示位移", slug: "vt-area-displacement", parentId: motion.id },
  });

  for (const tag of [
    ["图像题", "image-question", "feature"],
    ["课堂例题", "class-example", "usage"],
    ["随堂练习", "in-class-practice", "usage"],
    ["易错题", "common-mistake", "quality"],
  ] as const) {
    await prisma.tag.upsert({
      where: { slug: tag[1] },
      update: {},
      create: { name: tag[0], slug: tag[1], group: tag[2] },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

**Step 2: Configure seed command**

`package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Step 3: Run migration and seed**

Run:

```bash
npm run db:migrate -- --name init
npm run db:seed
```

Expected: migration applies and seed succeeds.

**Step 4: Commit**

```bash
git add prisma package.json
git commit -m "feat: seed physics knowledge taxonomy"
```

### Task 10: Add Knowledge Point API

**Files:**
- Create: `app/api/knowledge-points/route.ts`
- Create: `app/api/tags/route.ts`
- Create: `lib/domain/taxonomy-repository.ts`

**Step 1: Implement repository**

`lib/domain/taxonomy-repository.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export async function listKnowledgePoints() {
  return prisma.knowledgePoint.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function listTags() {
  return prisma.tag.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] });
}
```

**Step 2: Add routes**

`app/api/knowledge-points/route.ts`:

```ts
import { listKnowledgePoints } from "@/lib/domain/taxonomy-repository";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ knowledgePoints: await listKnowledgePoints() });
}
```

`app/api/tags/route.ts`:

```ts
import { listTags } from "@/lib/domain/taxonomy-repository";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ tags: await listTags() });
}
```

**Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS.

**Step 4: Commit**

```bash
git add app/api/knowledge-points app/api/tags lib/domain/taxonomy-repository.ts
git commit -m "feat: expose taxonomy api"
```

## Phase 4: Raw Assets and Drafts

### Task 11: Add Local Storage Service

**Files:**
- Create: `lib/storage/storage-service.ts`
- Create: `tests/unit/storage-service.test.ts`

**Step 1: Write failing test**

`tests/unit/storage-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildStorageKey } from "@/lib/storage/storage-service";

describe("storage service", () => {
  it("builds safe storage keys", () => {
    expect(buildStorageKey("raw", "题目 1.png")).toMatch(/^raw\/\d+-[a-z0-9-]+\.png$/);
  });
});
```

**Step 2: Implement storage key helper**

`lib/storage/storage-service.ts`:

```ts
export function buildStorageKey(prefix: string, originalName: string) {
  const extension = originalName.includes(".") ? originalName.split(".").pop()?.toLowerCase() : "bin";
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "asset";

  return `${prefix}/${Date.now()}-${base}.${extension}`;
}
```

**Step 3: Run test**

```bash
npm test -- tests/unit/storage-service.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add lib/storage tests/unit/storage-service.test.ts
git commit -m "feat: add local storage key helper"
```

### Task 12: Add Raw Asset Upload API

**Files:**
- Create: `app/api/raw-assets/route.ts`
- Create: `lib/domain/raw-asset-repository.ts`
- Modify: `lib/storage/storage-service.ts`
- Modify: `.gitignore`

**Step 1: Extend storage service**

Add:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveLocalUpload(storageKey: string, bytes: Buffer) {
  const root = process.env.LOCAL_UPLOAD_DIR ?? "./uploads";
  const fullPath = path.join(process.cwd(), root, storageKey);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, bytes);
  return storageKey;
}
```

**Step 2: Add repository**

`lib/domain/raw-asset-repository.ts`:

```ts
import { RawAssetKind } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function createRawAsset(input: {
  kind: RawAssetKind;
  originalName: string;
  mimeType?: string;
  storageKey?: string;
  textContent?: string;
}) {
  return prisma.rawAsset.create({
    data: {
      kind: input.kind,
      originalName: input.originalName,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      textContent: input.textContent,
    },
  });
}
```

**Step 3: Add route**

`app/api/raw-assets/route.ts`:

```ts
import { RawAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { createRawAsset } from "@/lib/domain/raw-asset-repository";
import { buildStorageKey, saveLocalUpload } from "@/lib/storage/storage-service";

function detectKind(mimeType: string): RawAssetKind {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.includes("markdown")) return "MARKDOWN";
  return "TEXT";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const text = formData.get("text");

  if (file instanceof File) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const storageKey = buildStorageKey("raw", file.name);
    await saveLocalUpload(storageKey, bytes);
    const asset = await createRawAsset({
      kind: detectKind(file.type),
      originalName: file.name,
      mimeType: file.type,
      storageKey,
    });
    return NextResponse.json({ rawAsset: asset }, { status: 201 });
  }

  if (typeof text === "string" && text.trim()) {
    const asset = await createRawAsset({
      kind: "TEXT",
      originalName: "pasted-text.txt",
      mimeType: "text/plain",
      textContent: text,
    });
    return NextResponse.json({ rawAsset: asset }, { status: 201 });
  }

  return NextResponse.json({ error: "file or text is required" }, { status: 400 });
}
```

**Step 4: Ignore uploads**

`.gitignore`:

```gitignore
uploads/
```

**Step 5: Run lint**

```bash
npm run lint
```

Expected: PASS.

**Step 6: Commit**

```bash
git add app/api/raw-assets lib/domain/raw-asset-repository.ts lib/storage/storage-service.ts .gitignore
git commit -m "feat: add raw asset upload api"
```

### Task 13: Add Draft Creation Service

**Files:**
- Create: `lib/workers/mock-parse-worker.ts`
- Create: `app/api/raw-assets/[id]/parse/route.ts`
- Create: `tests/unit/mock-parse-worker.test.ts`

**Step 1: Write failing parser test**

`tests/unit/mock-parse-worker.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseTextToDraft } from "@/lib/workers/mock-parse-worker";

describe("mock parse worker", () => {
  it("extracts answer from pasted text", () => {
    const draft = parseTextToDraft("题干\nA. 甲\nB. 乙\n答案：B\n解析：因为乙正确");
    expect(draft.answerJson).toEqual({ type: "single", value: "B" });
    expect(draft.optionsJson).toHaveLength(2);
  });
});
```

**Step 2: Implement mock parser**

`lib/workers/mock-parse-worker.ts`:

```ts
export function parseTextToDraft(text: string) {
  const answerMatch = text.match(/答案[:：]\s*([A-Z]+)/i);
  const solutionMatch = text.match(/解析[:：]\s*([\s\S]*)/);
  const optionMatches = [...text.matchAll(/^([A-D])[\.\、]\s*(.+)$/gim)];
  const optionsJson = optionMatches.map((match) => ({
    label: match[1].toUpperCase(),
    value: match[2].trim(),
  }));

  const stemMd = text
    .replace(/^([A-D])[\.\、]\s*.+$/gim, "")
    .replace(/答案[:：]\s*[A-Z]+/i, "")
    .replace(/解析[:：][\s\S]*/i, "")
    .trim();

  return {
    type: "SINGLE_CHOICE" as const,
    stemMd,
    optionsJson,
    answerJson: answerMatch ? { type: "single", value: answerMatch[1].toUpperCase() } : undefined,
    solutionMd: solutionMatch?.[1]?.trim(),
  };
}
```

**Step 3: Add parse route**

`app/api/raw-assets/[id]/parse/route.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { parseTextToDraft } from "@/lib/workers/mock-parse-worker";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawAsset = await prisma.rawAsset.findUnique({ where: { id } });

  if (!rawAsset) {
    return NextResponse.json({ error: "Raw asset not found" }, { status: 404 });
  }

  const parseJob = await prisma.parseJob.create({
    data: { rawAssetId: rawAsset.id, jobType: "mock_parse_text", status: "RUNNING", input: { rawAssetId: rawAsset.id } },
  });

  const parsed = parseTextToDraft(rawAsset.textContent ?? "");
  const draft = await prisma.questionDraft.create({
    data: {
      sourceRawAssetId: rawAsset.id,
      status: "NEEDS_REVIEW",
      type: parsed.type,
      stemMd: parsed.stemMd,
      optionsJson: parsed.optionsJson,
      answerJson: parsed.answerJson ?? undefined,
      solutionMd: parsed.solutionMd,
      aiOutput: parsed,
    },
  });

  await prisma.parseJob.update({
    where: { id: parseJob.id },
    data: { status: "SUCCEEDED", output: { draftId: draft.id } },
  });

  await prisma.agentRun.create({
    data: {
      agentName: "mock-structure-agent",
      toolName: "create_question_draft",
      input: { rawAssetId: rawAsset.id },
      output: parsed,
      draftId: draft.id,
    },
  });

  return NextResponse.json({ draft }, { status: 201 });
}
```

**Step 4: Run test**

```bash
npm test -- tests/unit/mock-parse-worker.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/workers app/api/raw-assets tests/unit/mock-parse-worker.test.ts
git commit -m "feat: add mock parse draft workflow"
```

## Phase 5: AI Suggestions and Human Review

### Task 14: Add Suggestion Service

**Files:**
- Create: `lib/workers/mock-classification-agent.ts`
- Create: `app/api/questions/[id]/classify/route.ts`
- Create: `tests/unit/mock-classification-agent.test.ts`

**Step 1: Write failing test**

`tests/unit/mock-classification-agent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestMetadata } from "@/lib/workers/mock-classification-agent";

describe("mock classification agent", () => {
  it("suggests v-t graph knowledge point from stem", () => {
    const result = suggestMetadata("速度-时间图像的面积表示什么？");
    expect(result.knowledge_points[0].value).toContain("v-t");
    expect(result.difficulty.value).toBe(2);
  });
});
```

**Step 2: Implement mock classification**

`lib/workers/mock-classification-agent.ts`:

```ts
export function suggestMetadata(stemMd: string) {
  const hasVt = /v-t|速度.?时间|速度-时间/.test(stemMd);

  return {
    knowledge_points: [
      {
        value: hasVt ? "v-t 图像面积表示位移" : "待人工确认",
        confidence: hasVt ? 0.86 : 0.35,
        reason: hasVt ? "题干出现速度-时间图像相关表述" : "规则无法稳定识别知识点",
      },
    ],
    difficulty: {
      value: hasVt ? 2 : 3,
      confidence: hasVt ? 0.72 : 0.4,
      reason: hasVt ? "基础概念应用，计算量较低" : "需要人工确认难度",
    },
    risks: hasVt ? [] : ["知识点置信度较低，请人工确认"],
  };
}
```

**Step 3: Add classify route**

`app/api/questions/[id]/classify/route.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { suggestMetadata } from "@/lib/workers/mock-classification-agent";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id } });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const output = suggestMetadata(question.stemMd);
  const agentRun = await prisma.agentRun.create({
    data: {
      agentName: "mock-classification-agent",
      toolName: "classify_question",
      input: { questionId: question.id, stemMd: question.stemMd },
      output,
      confidence: output.knowledge_points[0]?.confidence,
    },
  });

  const suggestion = await prisma.suggestion.create({
    data: {
      questionId: question.id,
      kind: "metadata",
      payload: output,
      confidence: output.knowledge_points[0]?.confidence,
      createdByAgentRunId: agentRun.id,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
```

**Step 4: Run test**

```bash
npm test -- tests/unit/mock-classification-agent.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/workers/mock-classification-agent.ts app/api/questions tests/unit/mock-classification-agent.test.ts
git commit -m "feat: add ai metadata suggestion workflow"
```

### Task 15: Add Suggestion Review API

**Files:**
- Create: `app/api/suggestions/[id]/route.ts`
- Create: `tests/unit/suggestion-policy.test.ts`
- Create: `lib/domain/suggestion-policy.ts`

**Step 1: Write failing policy test**

`tests/unit/suggestion-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canSuggestionWriteDirectlyToQuestion } from "@/lib/domain/suggestion-policy";

describe("suggestion policy", () => {
  it("prevents ai suggestions from directly mutating confirmed questions", () => {
    expect(canSuggestionWriteDirectlyToQuestion({ actor: "agent", kind: "metadata" })).toBe(false);
    expect(canSuggestionWriteDirectlyToQuestion({ actor: "human", kind: "metadata" })).toBe(true);
  });
});
```

**Step 2: Implement policy**

`lib/domain/suggestion-policy.ts`:

```ts
export function canSuggestionWriteDirectlyToQuestion(input: { actor: "agent" | "human"; kind: string }) {
  return input.actor === "human";
}
```

**Step 3: Add suggestion status route**

`app/api/suggestions/[id]/route.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status;

  if (!["accepted", "rejected", "pending_review"].includes(status)) {
    return NextResponse.json({ error: "Invalid suggestion status" }, { status: 400 });
  }

  const suggestion = await prisma.suggestion.update({
    where: { id },
    data: { status },
  });

  await prisma.reviewRecord.create({
    data: {
      resourceType: "suggestion",
      resourceId: suggestion.id,
      action: status,
      notes: body.notes,
    },
  });

  return NextResponse.json({ suggestion });
}
```

**Step 4: Run test**

```bash
npm test -- tests/unit/suggestion-policy.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/suggestions lib/domain/suggestion-policy.ts tests/unit/suggestion-policy.test.ts
git commit -m "feat: add suggestion review policy"
```

## Phase 6: Search and Agent API

### Task 16: Add Search Service

**Files:**
- Create: `lib/search/question-search.ts`
- Create: `app/api/search/questions/route.ts`
- Create: `tests/unit/question-search.test.ts`

**Step 1: Write failing query understanding test**

`tests/unit/question-search.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { understandQuestionSearchQuery } from "@/lib/search/question-search";

describe("question search understanding", () => {
  it("extracts v-t graph search constraints", () => {
    const result = understandQuestionSearchQuery("找 3 道高一运动学 v-t 图像面积表示位移的基础题，适合随堂练习，最好有图");
    expect(result.limit).toBe(3);
    expect(result.grade).toBe("高一");
    expect(result.knowledge_points).toContain("v-t 图像");
    expect(result.has_image).toBe(true);
  });
});
```

**Step 2: Implement lightweight understanding**

`lib/search/question-search.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export function understandQuestionSearchQuery(query: string) {
  const limitMatch = query.match(/(\d+)\s*道/);
  return {
    limit: limitMatch ? Number(limitMatch[1]) : 10,
    grade: query.includes("高一") ? "高一" : undefined,
    chapter: query.includes("运动学") ? "运动学" : undefined,
    knowledge_points: query.includes("v-t") || query.includes("速度-时间") ? ["v-t 图像", "位移"] : [],
    difficulty: query.includes("基础") ? [1, 2] : undefined,
    usage: query.includes("随堂练习") ? ["随堂练习"] : undefined,
    has_image: query.includes("有图") || query.includes("图像"),
  };
}

export async function searchQuestions(query: string, constraints?: { status?: string[]; limit?: number }) {
  const understanding = understandQuestionSearchQuery(query);
  const limit = constraints?.limit ?? understanding.limit;

  const questions = await prisma.question.findMany({
    where: {
      status: constraints?.status?.length ? { in: constraints.status as never } : undefined,
      OR: [
        { stemMd: { contains: "v-t", mode: "insensitive" } },
        { stemMd: { contains: "速度", mode: "insensitive" } },
        { solutionMd: { contains: "位移", mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return {
    understanding,
    results: questions.map((question) => ({
      question_id: question.publicId,
      id: question.id,
      score: 0.7,
      reason: "根据题干、解析和结构化条件匹配",
    })),
  };
}
```

**Step 3: Add route**

`app/api/search/questions/route.ts`:

```ts
import { searchQuestions } from "@/lib/search/question-search";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await searchQuestions(body.query ?? "", body.constraints);
  return NextResponse.json(result);
}
```

**Step 4: Run test**

```bash
npm test -- tests/unit/question-search.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/search app/api/search tests/unit/question-search.test.ts
git commit -m "feat: add question search service"
```

### Task 17: Add Agent API Authentication and Tools

**Files:**
- Create: `lib/auth/agent-auth.ts`
- Create: `app/api/agent/search-questions/route.ts`
- Create: `app/api/agent/questions/[id]/route.ts`
- Create: `tests/unit/agent-auth.test.ts`

**Step 1: Write failing auth test**

`tests/unit/agent-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasRequiredScopes } from "@/lib/auth/agent-auth";

describe("agent auth", () => {
  it("checks required scopes", () => {
    expect(hasRequiredScopes(["questions:read", "questions:search"], ["questions:search"])).toBe(true);
    expect(hasRequiredScopes(["questions:read"], ["exports:create"])).toBe(false);
  });
});
```

**Step 2: Implement auth helpers**

`lib/auth/agent-auth.ts`:

```ts
export function hasRequiredScopes(granted: string[], required: string[]) {
  return required.every((scope) => granted.includes(scope));
}

export function readDevAgentScopes(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (!process.env.AGENT_API_KEY_DEV || token !== process.env.AGENT_API_KEY_DEV) {
    return null;
  }

  return [
    "questions:read",
    "questions:search",
    "drafts:create",
    "suggestions:create",
    "quality:check",
    "question_sets:create",
    "exports:create",
  ];
}
```

**Step 3: Add agent search route**

`app/api/agent/search-questions/route.ts`:

```ts
import { hasRequiredScopes, readDevAgentScopes } from "@/lib/auth/agent-auth";
import { searchQuestions } from "@/lib/search/question-search";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const scopes = readDevAgentScopes(request);
  if (!scopes || !hasRequiredScopes(scopes, ["questions:search"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await searchQuestions(body.query ?? "", body.constraints);
  return NextResponse.json(result);
}
```

**Step 4: Add agent get question route**

`app/api/agent/questions/[id]/route.ts`:

```ts
import { hasRequiredScopes, readDevAgentScopes } from "@/lib/auth/agent-auth";
import { getQuestion } from "@/lib/domain/question-repository";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scopes = readDevAgentScopes(request);
  if (!scopes || !hasRequiredScopes(scopes, ["questions:read"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const question = await getQuestion(id);

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({ question });
}
```

**Step 5: Run tests**

```bash
npm test -- tests/unit/agent-auth.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add lib/auth app/api/agent tests/unit/agent-auth.test.ts
git commit -m "feat: add agent api auth and tools"
```

## Phase 7: Question Sets and Export

### Task 18: Add Question Set Service

**Files:**
- Create: `lib/domain/question-set-service.ts`
- Create: `app/api/question-sets/route.ts`
- Create: `tests/unit/question-set-service.test.ts`

**Step 1: Write failing order test**

`tests/unit/question-set-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildQuestionSetItems } from "@/lib/domain/question-set-service";

describe("question set service", () => {
  it("assigns stable sort order", () => {
    expect(buildQuestionSetItems(["q1", "q2"])).toEqual([
      { questionId: "q1", sortOrder: 1 },
      { questionId: "q2", sortOrder: 2 },
    ]);
  });
});
```

**Step 2: Implement helper and repository function**

`lib/domain/question-set-service.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export function buildQuestionSetItems(questionIds: string[]) {
  return questionIds.map((questionId, index) => ({ questionId, sortOrder: index + 1 }));
}

export async function createQuestionSet(input: { title: string; questionIds: string[] }) {
  return prisma.questionSet.create({
    data: {
      title: input.title,
      items: { create: buildQuestionSetItems(input.questionIds) },
    },
    include: { items: true },
  });
}
```

**Step 3: Add route**

`app/api/question-sets/route.ts`:

```ts
import { createQuestionSet } from "@/lib/domain/question-set-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.title || !Array.isArray(body.questionIds)) {
    return NextResponse.json({ error: "title and questionIds are required" }, { status: 400 });
  }

  const questionSet = await createQuestionSet(body);
  return NextResponse.json({ questionSet }, { status: 201 });
}
```

**Step 4: Run test**

```bash
npm test -- tests/unit/question-set-service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/domain/question-set-service.ts app/api/question-sets tests/unit/question-set-service.test.ts
git commit -m "feat: add question set creation"
```

### Task 19: Add Markdown and LaTeX Export

**Files:**
- Create: `lib/renderer/export-question-set.ts`
- Create: `app/api/question-sets/[id]/export/route.ts`
- Create: `tests/unit/export-question-set.test.ts`

**Step 1: Write failing export test**

`tests/unit/export-question-set.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderQuestionToLatex, renderQuestionToMarkdown } from "@/lib/renderer/export-question-set";

const question = {
  publicId: "q_motion_0001",
  stemMd: "速度为 $v$。",
  optionsJson: [{ label: "A", value: "$v$" }],
  answerJson: { type: "single", value: "A" },
  solutionMd: "解析",
};

describe("question exports", () => {
  it("renders markdown", () => {
    expect(renderQuestionToMarkdown(question)).toContain("答案：A");
  });

  it("renders latex choices", () => {
    expect(renderQuestionToLatex(question)).toContain("\\choice");
  });
});
```

**Step 2: Implement exporters**

`lib/renderer/export-question-set.ts`:

```ts
type ExportableQuestion = {
  publicId: string;
  stemMd: string;
  optionsJson: unknown;
  answerJson: unknown;
  solutionMd?: string | null;
};

function options(question: ExportableQuestion): { label: string; value: string }[] {
  return Array.isArray(question.optionsJson) ? (question.optionsJson as { label: string; value: string }[]) : [];
}

function answerText(question: ExportableQuestion) {
  const answer = question.answerJson as { type?: string; value?: unknown };
  return Array.isArray(answer.value) ? answer.value.join(", ") : String(answer.value ?? "");
}

export function renderQuestionToMarkdown(question: ExportableQuestion, teacher = true) {
  const optionText = options(question).map((option) => `${option.label}. ${option.value}`).join("\n\n");
  return [
    `<!-- ${question.publicId} -->`,
    question.stemMd,
    optionText,
    teacher ? `答案：${answerText(question)}` : "",
    teacher && question.solutionMd ? `解析：\n${question.solutionMd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function renderQuestionToLatex(question: ExportableQuestion, teacher = true) {
  const choices = options(question).map((option) => `\\choice ${option.value}`).join("\n");
  return [
    `\\question ${question.stemMd}`,
    choices ? `\\begin{choices}\n${choices}\n\\end{choices}` : "",
    teacher && question.solutionMd ? `\\begin{solution}\n${question.solutionMd}\n\\end{solution}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
```

**Step 3: Add export route**

`app/api/question-sets/[id]/export/route.ts`:

```ts
import { prisma } from "@/lib/db/prisma";
import { renderQuestionToLatex, renderQuestionToMarkdown } from "@/lib/renderer/export-question-set";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const format = body.format ?? "markdown";
  const questionSet = await prisma.questionSet.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" }, include: { question: true } } },
  });

  if (!questionSet) {
    return NextResponse.json({ error: "Question set not found" }, { status: 404 });
  }

  const content = questionSet.items
    .map((item) =>
      format === "latex"
        ? renderQuestionToLatex(item.question, body.teacher !== false)
        : renderQuestionToMarkdown(item.question, body.teacher !== false),
    )
    .join("\n\n---\n\n");

  const exportJob = await prisma.exportJob.create({
    data: {
      questionSetId: questionSet.id,
      format,
      status: "SUCCEEDED",
      outputKey: null,
    },
  });

  return NextResponse.json({ exportJob, content });
}
```

**Step 4: Run tests**

```bash
npm test -- tests/unit/export-question-set.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/renderer/export-question-set.ts app/api/question-sets tests/unit/export-question-set.test.ts
git commit -m "feat: add question set exports"
```

## Phase 8: Dashboard Pages

### Task 20: Add Question List and Search UI

**Files:**
- Create: `app/(dashboard)/questions/page.tsx`
- Create: `components/question/question-list.tsx`
- Create: `components/search/question-search-panel.tsx`

**Step 1: Implement question list page**

`app/(dashboard)/questions/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function QuestionsPage() {
  const questions = await prisma.question.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">题库</h1>
          <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/questions/new">
            新建题目
          </Link>
        </div>
        <div className="rounded border border-slate-200 bg-white">
          {questions.map((question) => (
            <Link key={question.id} href={`/questions/${question.id}`} className="block border-b border-slate-100 p-4 hover:bg-slate-50">
              <div className="font-medium">{question.publicId}</div>
              <div className="line-clamp-2 text-sm text-slate-600">{question.stemMd}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Add search panel component**

`components/search/question-search-panel.tsx`:

```tsx
"use client";

import { useState } from "react";

export function QuestionSearchPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<unknown>(null);

  async function search() {
    const response = await fetch("/api/search/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, constraints: { status: ["PUBLISHED", "REVIEWED"], limit: 10 } }),
    });
    setResult(await response.json());
  }

  return (
    <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
      <textarea className="min-h-24 w-full rounded border p-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：找 3 道高一运动学 v-t 图像面积表示位移的基础题" />
      <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={search}>搜索</button>
      {result ? <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs text-white">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
}
```

**Step 3: Include search panel on page**

Update `app/(dashboard)/questions/page.tsx` to render `<QuestionSearchPanel />` above the list.

**Step 4: Manual smoke**

Run:

```bash
npm run dev
```

Open `http://localhost:3000/questions`.

Expected: list and natural language search panel render.

**Step 5: Commit**

```bash
git add app/(dashboard)/questions components/search components/question/question-list.tsx
git commit -m "feat: add question list and search ui"
```

### Task 21: Add Draft Review Workspace

**Files:**
- Create: `app/(dashboard)/drafts/[id]/page.tsx`
- Create: `components/draft/draft-review-workspace.tsx`

**Step 1: Add server page**

`app/(dashboard)/drafts/[id]/page.tsx`:

```tsx
import { prisma } from "@/lib/db/prisma";
import { DraftReviewWorkspace } from "@/components/draft/draft-review-workspace";
import { notFound } from "next/navigation";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.questionDraft.findUnique({
    where: { id },
    include: { sourceRawAsset: true, suggestions: true, agentRuns: true },
  });

  if (!draft) notFound();

  return <DraftReviewWorkspace draft={draft} />;
}
```

**Step 2: Add workspace component**

`components/draft/draft-review-workspace.tsx`:

```tsx
"use client";

import { QuestionPreview } from "@/components/question/question-preview";

export function DraftReviewWorkspace({ draft }: { draft: any }) {
  const options = Array.isArray(draft.optionsJson) ? draft.optionsJson : [];

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 bg-slate-100 p-4 xl:grid-cols-[1fr_1fr_1fr]">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">原始素材</h2>
        <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-100 p-3 text-sm">{draft.sourceRawAsset?.textContent ?? draft.sourceRawAsset?.storageKey ?? "无原始内容"}</pre>
      </section>
      <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">结构化草稿</h2>
        <textarea className="min-h-40 w-full rounded border p-2 font-mono" defaultValue={draft.stemMd ?? ""} />
        <pre className="rounded bg-slate-950 p-3 text-xs text-white">{JSON.stringify({ options: draft.optionsJson, answer: draft.answerJson }, null, 2)}</pre>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">实时预览</h2>
        <QuestionPreview stemMd={draft.stemMd ?? ""} options={options} solutionMd={draft.solutionMd} showSolution />
        <pre className="rounded bg-white p-3 text-xs">{JSON.stringify(draft.suggestions, null, 2)}</pre>
      </section>
    </main>
  );
}
```

**Step 3: Manual smoke**

Create a text RawAsset through the API, parse it, and open `/drafts/<draftId>`.

Expected: raw content, draft editor area, and preview are visible in three columns.

**Step 4: Commit**

```bash
git add app/(dashboard)/drafts components/draft
git commit -m "feat: add draft review workspace"
```

## Phase 9: E2E and Quality Gates

### Task 22: Add Playwright Smoke Test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/app-smoke.spec.ts`

**Step 1: Add config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

**Step 2: Add smoke spec**

`tests/e2e/app-smoke.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("home links to manual question editor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "高中物理题库后台" })).toBeVisible();
  await page.getByRole("link", { name: "新建题目" }).click();
  await expect(page.getByRole("heading", { name: "新建题目" })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
});
```

**Step 3: Install browser**

```bash
npx playwright install chromium
```

**Step 4: Run E2E**

```bash
npm run test:e2e
```

Expected: smoke test passes.

**Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: add playwright smoke coverage"
```

### Task 23: Add Final Quality Commands

**Files:**
- Modify: `package.json`
- Create: `docs/development.md`

**Step 1: Add quality script**

`package.json`:

```json
{
  "check": "npm run lint && npm test"
}
```

**Step 2: Add development doc**

`docs/development.md`:

```md
# Development

## Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and set `DATABASE_URL`.
3. Run `npm install`.
4. Run `npm run db:migrate -- --name init`.
5. Run `npm run db:seed`.
6. Run `npm run dev`.

## Quality

Run:

```bash
npm run check
npm run test:e2e
```

## AI Boundary

AI may create drafts and suggestions. AI must not publish final questions, delete final questions, or directly overwrite confirmed metadata.
```

**Step 3: Run quality gate**

```bash
npm run check
```

Expected: lint and unit tests pass.

**Step 4: Commit**

```bash
git add package.json docs/development.md
git commit -m "docs: add development quality guide"
```

## Execution Checklist

Complete the tasks in order:

1. Initialize Next.js project.
2. Add testing harness.
3. Configure Prisma and database schema.
4. Define question domain schemas.
5. Add Markdown and LaTeX renderer.
6. Add question service.
7. Add question API routes.
8. Build manual question editor page.
9. Add seed data.
10. Add knowledge point API.
11. Add local storage service.
12. Add raw asset upload API.
13. Add draft creation service.
14. Add suggestion service.
15. Add suggestion review API.
16. Add search service.
17. Add Agent API authentication and tools.
18. Add question set service.
19. Add Markdown and LaTeX export.
20. Add question list and search UI.
21. Add draft review workspace.
22. Add Playwright smoke test.
23. Add final quality commands.

## Definition of Done

The MVP implementation is complete when:

- A user can open the app and manually create a Markdown + LaTeX physics question.
- The app can render a question preview with KaTeX.
- PostgreSQL stores structured questions, raw assets, drafts, suggestions, AgentRun records, question sets, and export jobs.
- A pasted text raw asset can be parsed into a QuestionDraft using the mock parser.
- AI/classification suggestions are saved as pending review and do not mutate final Question metadata directly.
- Natural language search returns structured understanding and existing question IDs.
- Agent API routes require an API key and scopes.
- A question set can be created and exported to Markdown or LaTeX.
- Unit tests pass with `npm test`.
- Lint passes with `npm run lint`.
- E2E smoke passes with `npm run test:e2e`.

