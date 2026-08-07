# Planner Agent V1.0

Planner Agent 是一个目标驱动的可控 AI 日程规划 Agent，基于 `docs` 目录中的 DOC-01 至 DOC-12 进行正式开发。

## 技术栈

- Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn 风格组件
- Prisma + PostgreSQL（本地 embedded-postgres，生产使用 Supabase PostgreSQL）
- Redis 可选（本地未配置时自动降级为内存限流/锁）
- LLM Provider 可插拔，未配置密钥时使用内置 Mock Planner 完成全链路开发与评估

## 本地启动

```bash
npm install
npm run db:setup
npm run db:push
npm run db:seed
npm run dev
```

打开 http://localhost:3000，注册账号后即可使用。

Seed 数据账号 `alpha@planner.local` / `Test1234!` 可直接登录体验。

## 常用命令

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

详细部署与测试说明见项目内 `docs/` 交付说明。

- [部署说明](docs/DEPLOYMENT.md)
- [测试说明](docs/TESTING.md)
- [Agent 评估报告](docs/EVAL_REPORT.md)
- [发布检查清单](docs/RELEASE_CHECKLIST.md)
