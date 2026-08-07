# 参与贡献

感谢你愿意参与 Planner Agent。提交贡献前请先阅读本文档。

## 开发环境

1. 安装 Node.js `>= 20.9` 与 npm。
2. Fork 本仓库并克隆到本地。
3. 安装依赖：`npm install`。
4. 复制环境变量：`cp .env.example .env`。
5. 启动本地数据库：`npm run db:start`。
6. 同步表结构：`npm run db:push`。
7. 写入种子数据：`npm run db:seed`。
8. 启动开发服务器：`npm run dev`。

## 分支与提交

- 从 `main` 创建功能分支，分支名建议使用 `feat/`、`fix/`、`docs/` 前缀。
- 提交信息使用 Conventional Commits：`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`。
- 不要提交 `.env`、真实数据库连接串、API Key 或本地数据目录。

## 提交前检查

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

如果改动涉及 API，请同时运行：

```bash
npm run test:api
npm run test:e2e
```

## Pull Request

1. 在 PR 中说明改动目的、影响范围和验证方式。
2. 保持 PR 范围聚焦，不要混入无关重构。
3. 维护者会在 Review 后合并；安全相关问题请走 [SECURITY.md](SECURITY.md) 私密上报。