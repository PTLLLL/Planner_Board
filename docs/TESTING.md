# Planner Agent 测试说明

## 测试命令

```bash
npm run typecheck
npm run test:unit
npm run test:api
npm run test:e2e
npm run build
```

## 测试覆盖

- 单元测试：日期工具、Prompt Renderer、Agent 输出校验、Mock Planner
- API 集成测试：注册、会话、任务创建、Agent 请求
- E2E 测试：注册登录、Dashboard、Daily Tasks 创建任务
- Agent 质量评估：`npm run db:setup` 后执行 `node scripts/smoke.mjs --eval`

## 冒烟脚本

```bash
node scripts/smoke.mjs
node scripts/smoke.mjs --eval
```

`--eval` 会运行 DOC-08 定义的 44 个评估用例并输出 Bad Case。

## 测试账号

Seed 数据包含以下账号（密码均为 `Test1234!`）：

| 账号 | 用途 |
| --- | --- |
| `alpha@planner.local` | 主测试用户 |
| `beta@planner.local` | 用户隔离测试用户 |
| `empty@planner.local` | 空数据用户 |
| `import@planner.local` | 旧数据导入用户 |
| `eval@planner.local` | Eval 专用用户 |
