import { describe, expect, it } from "vitest";
import { validateAgentOutput } from "@/lib/agent/output-validator";
import type { AgentContext } from "@/lib/agent/types";

const context: AgentContext = {
  currentDate: "2026-08-05",
  timezone: "Asia/Shanghai",
  trigger: "agent_input",
  userPreferences: {
    maxDailyTasks: 5,
    workStartTime: "09:00",
    workEndTime: "22:00",
    preferredFocusTime: "morning",
  },
  activeGoals: [{ id: "00000000-0000-4000-8000-000000000011", title: "作品集" }],
  todayTasks: [
    {
      id: "00000000-0000-4000-8000-000000000021",
      title: "完成课程作业",
      dateKey: "2026-08-05",
      priority: "medium",
      isDone: false,
      goalId: null,
    },
  ],
  next7DaysTasks: [],
  overdueUndoneTasks: [],
  recentCompletionRate: 0.5,
  overloadedDays: [],
  pendingActionsCount: 0,
  relatedGoal: null,
  relatedTask: null,
};

describe("agent output validator", () => {
  it("accepts valid JSON output", () => {
    const raw = JSON.stringify({
      summary: "建议创建任务",
      clarification_questions: [],
      proposed_actions: [
        {
          tool: "create_task",
          args: {
            title: "整理简历",
            dateKey: "2026-08-06",
            priority: "high",
            estimateMinutes: 45,
          },
          explanation: "明天上午执行",
          confidence: 0.9,
          risk_level: "low",
        },
      ],
      risks: [],
      overall_confidence: 0.88,
    });
    const result = validateAgentOutput(raw, context);
    expect(result.ok).toBe(true);
    expect(result.output?.proposed_actions).toHaveLength(1);
  });

  it("rejects unregistered tools", () => {
    const raw = JSON.stringify({
      summary: "删除",
      clarification_questions: [],
      proposed_actions: [{ tool: "delete_task", args: {}, explanation: "x", confidence: 0.9, risk_level: "high" }],
      risks: [],
      overall_confidence: 0.9,
    });
    const result = validateAgentOutput(raw, context);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toBe("AGENT_TOOL_INVALID");
  });

  it("rejects clarification with actions", () => {
    const raw = JSON.stringify({
      summary: "clarify",
      clarification_questions: ["哪个任务？"],
      proposed_actions: [{ tool: "create_task", args: {}, explanation: "x", confidence: 0.9, risk_level: "low" }],
      risks: [],
      overall_confidence: 0.9,
    });
    const result = validateAgentOutput(raw, context);
    expect(result.ok).toBe(false);
  });

  it("rejects task ids outside current user context", () => {
    const raw = JSON.stringify({
      summary: "移动",
      clarification_questions: [],
      proposed_actions: [
        {
          tool: "move_task",
          args: { taskId: "00000000-0000-4000-8000-000000009999", newDateKey: "2026-08-06" },
          explanation: "x",
          confidence: 0.9,
          risk_level: "medium",
        },
      ],
      risks: [],
      overall_confidence: 0.9,
    });
    const result = validateAgentOutput(raw, context);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toBe("RESOURCE_FORBIDDEN");
  });
});
