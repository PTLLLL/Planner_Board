export const AGENT_TOOLS = ["create_task", "update_task", "move_task", "split_task"] as const;

export type AgentTool = (typeof AGENT_TOOLS)[number];
export type RiskLevel = "low" | "medium" | "high";

export interface ProposedAction {
  tool: AgentTool;
  args: Record<string, unknown>;
  explanation: string;
  confidence: number;
  risk_level: RiskLevel;
}

export interface AgentOutput {
  summary: string;
  clarification_questions: string[];
  proposed_actions: ProposedAction[];
  risks: string[];
  overall_confidence: number;
}

export interface AgentTrigger {
  requestText: string;
  trigger:
    | "dashboard_plan_today"
    | "agent_input"
    | "goal_decompose"
    | "daily_task_move"
    | "daily_task_split";
  relatedGoalId?: string;
  relatedTaskId?: string;
}

export interface AgentContext {
  currentDate: string;
  timezone: string;
  trigger: AgentTrigger["trigger"];
  userPreferences: {
    maxDailyTasks: number;
    workStartTime: string;
    workEndTime: string;
    preferredFocusTime: string;
  };
  activeGoals: Array<Record<string, unknown>>;
  todayTasks: Array<Record<string, unknown>>;
  next7DaysTasks: Array<Record<string, unknown>>;
  overdueUndoneTasks: Array<Record<string, unknown>>;
  recentCompletionRate: number;
  overloadedDays: string[];
  pendingActionsCount: number;
  relatedGoal: Record<string, unknown> | null;
  relatedTask: Record<string, unknown> | null;
}
