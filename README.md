# Planner Agent

> 目标驱动的可控 AI 日程规划 Agent
> Version 1.0.0

Planner Agent 是一个目标驱动的可控 AI 日程规划 Agent。用户可以用自然语言描述目标与任务，Agent 会结合当前目标、任务、日期和完成情况生成结构化日程建议；所有写操作都先进入“建议”状态，经过用户确认后才执行，并保留完整运行记录与操作日志。

本项目按照产品与技术文档（DOC-01 至 DOC-12）进行正式开发，覆盖产品定义、用户研究、竞品分析、PRD、信息架构、AI Agent 设计、数据模型与 API、Eval 评估、Prompt 规范、埋点方案和测试计划。

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [页面与模块](#页面与模块)
- [主要 API](#主要-api)
- [技术栈](#技术栈)
- [架构说明](#架构说明)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [LLM 配置](#llm-配置)
- [数据库与迁移](#数据库与迁移)
- [Redis 配置](#redis-配置)
- [测试与质量](#测试与质量)
- [部署](#部署)
- [生产环境状态](#生产环境状态)
- [常见问题](#常见问题)
- [开源与贡献](#开源与贡献)
- [项目文档](#项目文档)
- [版本记录](#版本记录)

## 项目简介

Planner Agent 面向需要长期目标管理和每日日程安排的用户，核心目标是让 AI 建议“可控、可解释、可追溯”：

- 目标拆解为可执行任务；
- 任务按日期、优先级和可用时间自动排布；
- Agent 只提出建议，不擅自修改数据；
- 每次运行都记录上下文、模型输出、动作和结果；
- 内置 Eval 体系持续评估 Agent 输出质量。

## 核心功能

- 账号与安全
  - 注册、登录、登出；
  - Argon2 密码哈希；
  - JWT HttpOnly Cookie 会话；
  - CSRF Token 防护；
  - API 限流（内存或 Redis）。

- 目标管理
  - 创建、编辑、完成、归档目标；
  - 支持目标日期、描述和来源标记；
  - 目标进度按关联任务自动统计。

- 任务管理
  - 创建、编辑、删除任务；
  - 支持日期、开始/结束时间、预估时长、优先级；
  - 支持完成任务、取消完成、移动日期；
  - 按日查看与每周负载分析。

- 日历视图
  - 按日期展示任务分布；
  - 识别过载日期和时间过载。

- 数据仪表盘
  - 今日任务完成率；
  - 本周任务负载；
  - 目标推进明细；
  - Agent 建议与最近动作。

- AI Agent
  - 自然语言请求；
  - 内置 Mock Planner，未配置模型时仍可体验完整流程；
  - 支持 OpenAI、DashScope、DeepSeek 等兼容接口；
  - 结构化 JSON 输出校验；
  - 工具：创建任务、更新任务、移动任务、拆分任务；
  - 所有动作先进入待确认状态；
  - Agent 收件箱支持批准、编辑、拒绝和反馈。

- 评估体系
  - 内置 Eval 用例；
  - 支持运行评估、查看结果与摘要；
  - 覆盖日期解析、工具调用、计划质量和安全边界。

- 数据导入
  - 预览导入数据；
  - 执行导入，保留 legacy id 映射。

- 可观测性
  - 操作审计日志；
  - 埋点事件写入；
  - 结构化日志级别配置。

- 用户偏好
  - 时区；
  - 每日最大任务数；
  - 工作时段；
  - 偏好专注时间；
  - 是否要求 Agent 动作确认。

## 页面与模块

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 产品介绍与入口 |
| 登录 / 注册 | `/login`、`/register` | 账号认证 |
| 仪表盘 | `/dashboard` | 今日、本周、目标与 Agent 摘要 |
| 日历 | `/calendar` | 任务日期分布与过载提示 |
| 每日任务 | `/tasks/daily` | 日任务管理与创建 |
| 目标 | `/goals` | 目标进度与管理 |
| Agent 收件箱 | `/agent/inbox` | 待确认动作 |
| Agent 控制台 | `/agent/console` | 运行记录与对话 |
| Eval | `/eval` | 评估用例、运行与结果 |
| 设置 | `/settings` | 用户偏好与安全 |

## 主要 API

所有 API 位于 `src/app/api`，按领域分组：

| 领域 | 路由 | 说明 |
| --- | --- | --- |
| 认证 | `/api/auth/register`、`/api/auth/login`、`/api/auth/logout` | 注册、登录、登出 |
| 当前用户 | `/api/me`、`/api/me/preferences` | 用户信息与偏好 |
| 目标 | `/api/goals`、`/api/goals/[id]`、`/api/goals/[id]/complete`、`/api/goals/[id]/archive` | 目标 CRUD 与状态流转 |
| 任务 | `/api/tasks`、`/api/tasks/[id]`、`/api/tasks/[id]/complete`、`/api/tasks/[id]/uncomplete`、`/api/tasks/[id]/move` | 任务 CRUD 与状态流转 |
| 仪表盘 | `/api/dashboard/today`、`/api/dashboard/weekly-load`、`/api/dashboard/goal-progress`、`/api/dashboard/agent-summary` | 仪表盘聚合数据 |
| Agent | `/api/agent/chat`、`/api/agent/runs`、`/api/agent/runs/[id]`、`/api/agent/actions`、`/api/agent/actions/[id]/approve`、`/api/agent/actions/[id]/edit`、`/api/agent/actions/[id]/reject`、`/api/agent/actions/[id]/feedback` | 对话、运行记录、动作确认与反馈 |
| 导入 | `/api/import/preview`、`/api/import/execute` | 数据导入 |
| 评估 | `/api/eval/cases`、`/api/eval/results`、`/api/eval/run`、`/api/eval/summary` | Eval 用例、运行与汇总 |
| 埋点 | `/api/events` | 客户端事件上报 |

## 技术栈

- Next.js 15 App Router + React 19 + TypeScript
- Tailwind CSS 3 + shadcn 风格组件
- Prisma 6 + PostgreSQL
- React Query、Recharts、Sonner、Lucide、date-fns
- jose（JWT）、@node-rs/argon2（密码哈希）、Zod（校验）
- ioredis（可选 Redis）
- Vitest、Supertest、Playwright（测试）

## 架构说明

项目采用 App Router 全栈结构：

- 前端页面以 Client Component 为主，通过 React Query 调用 API；
- API Route Handler 统一做会话校验、CSRF 校验和错误处理；
- 领域逻辑集中在 `src/lib/services`；
- Agent 流程集中在 `src/lib/agent`：
  - `context.service.ts` 组装用户上下文；
  - `prompt-renderer.ts` 渲染 Prompt；
  - `llm-client.ts` 调用模型或 Mock；
  - `output-validator.ts` 校验结构化输出；
  - `tool-executor.service.ts` 执行工具；
  - `action-approval.service.ts` 管理动作确认；
  - `orchestrator.service.ts` 编排完整运行。
- 数据库访问统一通过 Prisma Client；
- 限流默认使用内存实现，配置 `REDIS_URL` 后切换为 Redis。

## 目录结构

```text
planner-agent/
├─ prisma/
│  ├─ schema.prisma          # 数据模型
│  ├─ migrations/            # 迁移 SQL
│  └─ seed.ts                # 种子数据
├─ scripts/
│  ├─ dev-db.mjs             # 本地 embedded-postgres
│  ├─ vercel-build.mjs       # Vercel 构建入口
│  ├─ smoke.mjs              # 冒烟脚本
│  ├─ capture-design.mjs     # 设计截图
│  └─ check-layout.mjs       # 布局检查
├─ src/
│  ├─ app/
│  │  ├─ (app)/              # 登录后页面
│  │  ├─ api/                # API 路由
│  │  ├─ login/register/     # 认证页面
│  │  └─ page.tsx            # 首页
│  ├─ components/
│  │  ├─ ui/                 # 基础 UI 组件
│  │  └─ app-shell.tsx       # 应用外壳
│  └─ lib/
│     ├─ agent/              # Agent 编排与工具
│     ├─ auth/               # 会话与鉴权
│     ├─ services/           # 领域服务
│     └─ schemas/            # Zod 校验
├─ tests/
│  ├─ unit/                  # 单元测试
│  ├─ integration/           # API 集成测试
│  └─ e2e/                   # Playwright E2E
├─ docs/                     # 部署、测试、评估与发布文档
├─ design-qa/                # 设计验证截图与说明
├─ .env.example              # 环境变量示例
├─ vercel.json               # Vercel 构建配置
└─ package.json
```

## 环境要求

- Node.js `>= 20.9`
- npm
- 本地开发无需安装 PostgreSQL，项目使用 embedded-postgres；
- 如使用 Docker 方案，需要 Docker Desktop；
- 生产环境需要 Vercel 与 Supabase 账号。

## 快速开始

首次本地启动：

```bash
npm install
cp .env.example .env
```

启动本地数据库（保持运行）：

```bash
npm run db:start
```

初始化表结构并写入种子数据：

```bash
npm run db:push
npm run db:seed
```

启动开发服务器：

```bash
npm run dev
```

打开 <http://localhost:3000>，注册账号即可使用。

种子账号（密码均为 `Test1234!`）：

| 账号 | 用途 |
| --- | --- |
| `alpha@planner.local` | 主测试用户，包含目标、任务、Agent 动作 |
| `beta@planner.local` | 用户隔离测试 |
| `empty@planner.local` | 空数据用户 |
| `import@planner.local` | 数据导入测试 |
| `eval@planner.local` | Eval 专用用户 |

停止本地数据库：

```bash
npm run db:stop
```

Docker 替代方案：

```bash
docker compose up -d
```

使用 Docker 时，将 `DATABASE_URL` 指向 `localhost:5432`，并可选配置 `REDIS_URL=redis://localhost:6379`。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改。本地默认值如下：

| 变量 | 本地默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 运行环境 |
| `APP_BASE_URL` | `http://localhost:3000` | 应用访问地址 |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:55432/planner_agent` | Prisma 运行时连接 |
| `DIRECT_URL` | 同上 | Prisma 迁移直连 |
| `SESSION_JWT_SECRET` | 本地开发密钥 | 生产必须替换为随机密钥 |
| `SESSION_COOKIE_NAME` | `planner_session` | 会话 Cookie 名称 |
| `SESSION_MAX_AGE_DAYS` | `7` | 会话有效期 |
| `REDIS_URL` | 空 | Redis 连接；为空时使用内存限流 |
| `LLM_PROVIDER` | `mock` | `mock` / `openai` / `dashscope` / `deepseek` / `modelscope` |
| `LLM_BASE_URL` | 空 | 自定义兼容接口地址 |
| `LLM_API_KEY` | 空 | 模型 API Key |
| `LLM_MODEL_NAME` | `planner-agent-mock` | 模型名称 |
| `LLM_TIMEOUT_MS` | `45000` | 模型调用超时 |
| `LLM_MAX_RETRY` | `1` | 模型输出重试次数 |
| `ANALYTICS_ENABLED` | `true` | 是否写入埋点事件 |
| `ANALYTICS_RETENTION_DAYS` | `180` | 埋点保留天数 |
| `RATE_LIMIT_ENABLED` | `true` | 是否启用限流 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `EMBEDDED_PG_PORT` | `55432` | 本地数据库端口 |
| `EMBEDDED_PG_DATA_DIR` | `./data/postgres` | 本地数据目录 |

## LLM 配置

`LLM_PROVIDER` 为 `mock`（或未设置）时，Agent 使用内置 Mock Planner，便于本地开发、测试和流程演示；设置为真实 Provider 后，必须同时配置 `LLM_API_KEY` 和 `LLM_MODEL_NAME`，否则会直接返回配置错误。

启用真实模型时设置：

```text
LLM_PROVIDER=modelscope
LLM_BASE_URL=https://api-inference.modelscope.cn/v1
LLM_API_KEY=sk-xxx
LLM_MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
```

内置默认接口：

| Provider | 默认地址 |
| --- | --- |
| `openai` | `https://api.openai.com/v1/chat/completions` |
| `dashscope` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| `modelscope` | `https://api-inference.modelscope.cn/v1/chat/completions` |
| `deepseek` | `https://api.deepseek.com/chat/completions` |

也可以通过 `LLM_BASE_URL` 覆盖为其他兼容 OpenAI Chat Completions 的服务；填写根地址（如 `.../v1`）时，程序会自动补全 `/chat/completions`。

## 数据库与迁移

- 数据模型：`prisma/schema.prisma`
- 迁移文件：`prisma/migrations/`
- 种子数据：`prisma/seed.ts`

常用命令：

```bash
npm run db:push      # 本地直接同步 schema
npm run db:migrate   # 生产迁移（prisma migrate deploy）
npm run db:seed      # 写入种子数据
```

生产环境首次部署时，`scripts/vercel-build.mjs` 会自动执行 `prisma migrate deploy`。

## Redis 配置

Redis 是可选项。配置 `REDIS_URL` 后：

- 限流使用 Redis 分布式计数；
- 未配置时自动降级为进程内存限流。

Docker 本地 Redis：

```bash
docker compose up -d redis
```

## 测试与质量

| 命令 | 说明 |
| --- | --- |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:unit` | Vitest 单元测试 |
| `npm run test:api` | API 集成测试（需先启动 dev server） |
| `npm run test:e2e` | Playwright E2E（需数据库和 dev server） |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint 检查 |

冒烟与评估：

```bash
node scripts/smoke.mjs
node scripts/smoke.mjs --eval
```

详细说明见 [docs/TESTING.md](docs/TESTING.md)。

## 部署

生产环境推荐 Vercel + Supabase PostgreSQL：

1. 创建 Supabase 项目；
2. 在 Vercel 配置环境变量；
3. 推送 `main` 分支；
4. Vercel 构建时自动执行迁移并构建。

`vercel.json` 构建命令为：

```text
node scripts/vercel-build.mjs
```

该脚本会依次执行：

```text
npx prisma migrate deploy
npx next build
```

完整步骤、连接串选择和安全检查见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 生产环境状态

当前线上版本（Vercel + Supabase）未配置真实 LLM：

- `LLM_PROVIDER` 默认为 `mock`；
- Agent 的智能规划、对话生成等功能走内置 Mock，用于流程演示，不能执行真实 AI 日程规划；
- 注册登录、目标、任务、日历、评估等基础功能不依赖 LLM，可以正常使用。

如需启用真实 Agent 能力，在 Vercel 环境变量中配置：

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `LLM_PROVIDER` | `openai` / `dashscope` / `deepseek` / `modelscope` | 模型服务商 |
| `LLM_API_KEY` | `sk-...` | 服务商 API Key |
| `LLM_MODEL_NAME` | `gpt-4o-mini` 等 | 模型名称 |

配置完成后在 Vercel 重新 Deploy。

## 常见问题

- 本地数据库端口冲突：修改 `EMBEDDED_PG_PORT` 后重新执行 `npm run db:start`。
- Vercel 卡在 `Installing dependencies...`：检查 `package-lock.json` 是否包含 `registry.npmmirror.com`，项目根目录 `.npmrc` 已固定为 `registry.npmjs.org`。
- Vercel 报 `EBADPLATFORM @embedded-postgres/windows-x64`：不要把 Windows 专用二进制加入 `devDependencies`，`embedded-postgres` 会通过 `optionalDependencies` 自动选择平台包。
- Vercel 报 `P1001` 且地址是 `db.<project-ref>.supabase.co:5432`：这是 Supabase IPv6-only 直连，Vercel 无法访问；`DIRECT_URL` 应使用 Session pooler（5432 + `?pgbouncer=true`）。
- Agent 没有真实 AI 能力：检查 `LLM_PROVIDER`、`LLM_API_KEY`、`LLM_MODEL_NAME` 是否配置并已重新部署。`LLM_API_KEY` 不能填写接口地址，`LLM_MODEL_NAME` 不能是 `planner-agent-mock`。

## 开源与贡献

本项目以 MIT License 开源。贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，发现安全问题请按 [SECURITY.md](SECURITY.md) 私密上报。

- [参与贡献](CONTRIBUTING.md)
- [安全说明](SECURITY.md)
- [开源协议](LICENSE)

## 项目文档

- [部署说明](docs/DEPLOYMENT.md)
- [测试说明](docs/TESTING.md)
- [Agent 评估报告](docs/EVAL_REPORT.md)
- [发布检查清单](docs/RELEASE_CHECKLIST.md)
- [设计验证说明](design-qa/concept-spec.md)

## 版本记录

| 版本 | 说明 |
| --- | --- |
| 1.0.0 | 首个正式版本：完成核心产品、Agent 流程、Eval、测试与部署支持 |
