import { describe, expect, it } from "vitest";
import { mockPlanner } from "@/lib/agent/mock-planner";
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
  activeGoals: [{ id: "00000000-0000-4000-8000-000000000011", title: "完成 AI PM 作品集" }],
  todayTasks: [
    { id: "00000000-0000-4000-8000-000000000021", title: "整理简历项目经历", dateKey: "2026-08-05", priority: "high", isDone: false, goalId: null },
  ],
  next7DaysTasks: [],
  overdueUndoneTasks: [],
  recentCompletionRate: 0.5,
  overloadedDays: [],
  pendingActionsCount: 0,
  relatedGoal: null,
  relatedTask: null,
};

describe("mock planner", () => {
  it("rejects delete requests", () => {
    const output = mockPlanner(context, "删除我今天的任务");
    expect(output.proposed_actions).toHaveLength(0);
    expect(output.risks.join("")).toContain("删除");
  });

  it("creates a task with a relative date", () => {
    const output = mockPlanner(context, "明天上午整理简历项目经历");
    expect(output.proposed_actions[0].tool).toBe("create_task");
    expect(output.proposed_actions[0].args.dateKey).toBe("2026-08-06");
  });

  it("moves an existing task", () => {
    const output = mockPlanner(context, "把整理简历项目经历移到后天");
    expect(output.proposed_actions[0].tool).toBe("move_task");
    expect(output.proposed_actions[0].args.newDateKey).toBe("2026-08-07");
  });

  it("splits a task into subtasks", () => {
    const output = mockPlanner(context, "把整理简历项目经历拆成三个小任务");
    expect(output.proposed_actions[0].tool).toBe("split_task");
    expect((output.proposed_actions[0].args.subtasks as unknown[]).length).toBe(3);
  });

  it("asks clarification when date is missing", () => {
    const output = mockPlanner(context, "帮我安排一个任务");
    expect(output.clarification_questions.length).toBeGreaterThan(0);
    expect(output.proposed_actions).toHaveLength(0);
  });
});
