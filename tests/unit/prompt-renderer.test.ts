import { describe, expect, it } from "vitest";
import { PROMPT_VERSION, renderPrompt, renderRetryInstruction } from "@/lib/agent/prompt-renderer";
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
  activeGoals: [],
  todayTasks: [],
  next7DaysTasks: [],
  overdueUndoneTasks: [],
  recentCompletionRate: 0,
  overloadedDays: [],
  pendingActionsCount: 0,
  relatedGoal: null,
  relatedTask: null,
};

describe("prompt renderer", () => {
  it("includes system rules, context and output instruction", () => {
    const prompt = renderPrompt(context, "帮我安排今天");
    expect(prompt).toContain("Planner Agent");
    expect(prompt).toContain("当前上下文");
    expect(prompt).toContain("2026-08-05");
    expect(prompt).toContain("proposed_actions");
    expect(prompt).toContain("不能删除任务");
  });

  it("adds trigger-specific instruction", () => {
    const prompt = renderPrompt({ ...context, trigger: "goal_decompose" }, "帮我拆解这个目标");
    expect(prompt).toContain("请优先围绕 relatedGoal 拆解任务");
  });

  it("exposes a versioned prompt", () => {
    expect(PROMPT_VERSION).toBe("planner-agent-v1.0.0");
    expect(renderRetryInstruction()).toContain("不得使用未注册工具");
  });
});
