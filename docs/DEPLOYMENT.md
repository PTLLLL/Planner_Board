# Planner Agent 部署说明（Vercel + Supabase）

Planner Agent 使用 Next.js 作为应用层，Prisma 连接 PostgreSQL。生产环境推荐 Vercel 托管应用、Supabase 提供 PostgreSQL，Redis 可选（Upstash）。

## 1. 准备

- Node.js 20+
- Git 仓库（GitHub / GitLab / Bitbucket 均可），Vercel 通过仓库导入
- Vercel 账号、Supabase 账号

## 2. 创建 Supabase 项目

1. 打开 <https://supabase.com/dashboard>，点击 New project。
2. 选择区域（建议与 Vercel 区域接近），设置数据库密码并妥善保存。
3. 创建后进入 Project Settings -> Database，复制连接信息：
   - Transaction pooler：端口 `6543`，用于 `DATABASE_URL`
   - Session pooler：端口 `5432`（带 `?pgbouncer=true`），用于 `DIRECT_URL`；新项目直连是 IPv6-only，Vercel 无法访问
4. 本项目使用 Prisma Migrate，首次部署会自动创建表，不需要手工建表。

## 3. 配置 Vercel 环境变量

在 Vercel 项目 Settings -> Environment Variables 中添加：

| 变量 | 示例 / 说明 |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require`，事务连接池 |
| `DIRECT_URL` | `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?pgbouncer=true&sslmode=require`，迁移直连 |
| `APP_BASE_URL` | `https://<your-project>.vercel.app` |
| `SESSION_JWT_SECRET` | 32 字节随机值，必填 |
| `SESSION_COOKIE_NAME` | `planner_session` |
| `SESSION_MAX_AGE_DAYS` | `7` |
| `ANALYTICS_ENABLED` | `true` |
| `RATE_LIMIT_ENABLED` | `true` |
| `LOG_LEVEL` | `info` |
| `REDIS_URL` | 可选；为空时使用内存限流 |
| `LLM_PROVIDER` | `mock`、`openai`、`dashscope`、`deepseek` |
| `LLM_API_KEY` | 可选；未配置时使用内置 Mock |
| `LLM_MODEL_NAME` | 可选，默认 `planner-agent-mock` |

生成 `SESSION_JWT_SECRET`：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

不要提交 `.env`，不要把真实密码和 API Key 写入代码仓库。

## 4. 推送代码并导入 Vercel

当前 `planner-agent` 目录还没有 Git 仓库，先在应用目录初始化并推送：

```bash
cd D:\PM\Planner_Agent\planner-agent
git init
git add .
git commit -m "chore: prepare Vercel deployment"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

然后到 Vercel：

1. 打开 <https://vercel.com/new>，Import 刚推送的仓库。
2. Framework Preset 选择 Next.js（通常自动识别）。
3. 如果 Git 仓库根目录是 `D:\PM\Planner_Agent`，Root Directory 填写 `planner-agent`；如果在 `planner-agent` 内初始化仓库，保持默认根目录即可。
4. 添加第 3 节的环境变量。
5. 点击 Deploy。

项目已包含 `vercel.json`，构建命令为：

```bash
npx prisma migrate deploy && next build
```

首次构建会自动把 `prisma/migrations` 应用到 Supabase。之后每次部署也会执行迁移；如果使用 Preview 分支且不希望每次构建都改动生产数据库，删除 `vercel.json` 中的 `buildCommand`，并在发布前手动执行：

```bash
npx prisma migrate deploy
```

## 5. 本地开发（保持原样）

```bash
npm install
npm run db:setup
npm run db:push
npm run db:seed
npm run dev
```

本地 PostgreSQL 使用 embedded-postgres，默认监听 `localhost:55432`。

## 6. 上线验证

1. 打开 Vercel 域名，注册账号并登录。
2. 创建目标、任务，使用 Agent 控制台提交一次请求。
3. 到 Supabase Dashboard -> Table Editor 确认 `users`、`tasks`、`agent_runs`、`agent_actions` 等表已创建。
4. 可选：导入演示数据（在本地使用生产连接执行 seed）。

```powershell
$env:DATABASE_URL="<supabase transaction pooler>"
$env:DIRECT_URL="<supabase session pooler>"
npx prisma db seed
```

## 7. 后续建议

- 绑定自定义域名：Vercel Settings -> Domains。
- 分布式限流：创建 Upstash Redis，配置 `REDIS_URL`。
- 真实模型：设置 `LLM_PROVIDER` 和 `LLM_API_KEY`。
- 环境隔离：Production / Preview / Staging 使用独立的 Supabase 项目或数据库。
- 备份：开启 Supabase 自动备份，或定期导出。

## 8. 常见问题

- 构建失败提示 `DATABASE_URL` 找不到：确认 Vercel 环境变量已保存，并重新 Deploy。
- 迁移失败：确认 `DIRECT_URL` 使用 Session pooler（5432 + `?pgbouncer=true`），数据库密码正确。
- 报错 `P1001 Can't reach database server` 且地址是 `db.<project-ref>.supabase.co:5432`：这是 IPv6-only 直连，Vercel 无法访问；把 `DIRECT_URL` 改为 Session pooler 地址。
- 登录后立即退出：确认 `SESSION_JWT_SECRET` 已设置为随机密钥，且 Production / Preview 环境一致。
- 数据库连接过多：确认 `DATABASE_URL` 使用 transaction pooler，而不是直连。

## 9. Vercel 安装依赖卡住

如果构建日志停在 `Installing dependencies...`，检查 `package-lock.json` 是否使用了 `registry.npmmirror.com`。Vercel 在美国机房访问该镜像可能很慢或失败，应改为 `https://registry.npmjs.org/`。项目根目录的 .npmrc 已固定为 npmjs registry。

如果 Vercel 报 EBADPLATFORM @embedded-postgres/windows-x64，说明 Windows 专用二进制被写进了 devDependencies；应删除该直接依赖，让 embedded-postgres 通过 optionalDependencies 自动选择当前平台包。