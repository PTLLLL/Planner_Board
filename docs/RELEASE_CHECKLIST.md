# V1.0 发布检查清单

- [ ] DOC-08 评估报告已生成并通过 EVAL-GATE-01
- [ ] staging 冒烟测试通过
- [ ] production 环境变量完整且密钥已更换
- [ ] `LLM_API_KEY` 未出现在前端包、日志或响应中
- [ ] 数据库迁移已执行（`prisma migrate deploy`）
- [ ] Redis 可用或已确认内存降级策略
- [ ] `analytics_events` 表已创建
- [ ] 限流配置生效
- [ ] 备份策略已启用
- [ ] 回滚方案已确认
- [ ] S0/S1 缺陷全部关闭
- [ ] 发布后冒烟测试已计划
