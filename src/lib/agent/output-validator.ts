import { z } from "zod";
import type { AgentContext, AgentOutput, AgentTool, ProposedAction } from "@/lib/agent/types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const uuidSchema = z.string().uuid();

const createTaskSchema = z
  .object({
    title: z.string().min(1).max(160),
    dateKey: dateSchema,
    priority: z.enum(["low", "medium", "high"]),
    description: z.string().max(1000).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    estimateMinutes: z.number().int().min(5).max(480).optional(),
    goalId: uuidSchema.optional(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
    message: "结束时间不得早于或等于开始时间",
  });

const updateTaskSchema = z
  .object({
    taskId: uuidSchema,
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(1000).optional(),
    dateKey: dateSchema.optional(),
    startTime: timeSchema.nullish(),
    endTime: timeSchema.nullish(),
    estimateMinutes: z.number().int().min(5).max(480).nullish(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    goalId: uuidSchema.nullish(),
  })
  .refine((data) => !data.startTime || !data.endTime || data.endTime > data.startTime, {
    message: "结束时间不得早于或等于开始时间",
  });

const moveTaskSchema = z.object({
  taskId: uuidSchema,
  newDateKey: dateSchema,
});

const subtaskSchema = z.object({
  title: z.string().min(1).max(160),
  dateKey: dateSchema,
  priority: z.enum(["low", "medium", "high"]).optional(),
  estimateMinutes: z.number().int().min(5).max(480).optional(),
  goalId: uuidSchema.optional(),
});

const splitTaskSchema = z.object({
  sourceTaskId: uuidSchema,
  subtasks: z.array(subtaskSchema).min(2).max(8).refine(
    (items) => new Set(items.map((item) => item.title)).size === items.length,
    "子任务标题不得完全相同",
  ),
});

const outputSchema = z.object({
  summary: z.string().min(1),
  clarification_questions: z.array(z.string()).max(2),
  proposed_actions: z.array(z.unknown()).max(20),
  risks: z.array(z.string()),
  overall_confidence: z.number().min(0).max(1),
});

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    return null;
  }
}

function taskIds(context: AgentContext): Set<string> {
  const ids = new Set<string>();
  for (const list of [
    context.todayTasks,
    context.next7DaysTasks,
    context.overdueUndoneTasks,
  ]) {
    for (const task of list) ids.add(String(task.id));
  }
  if (context.relatedTask?.id) ids.add(String(context.relatedTask.id));
  return ids;
}

function goalIds(context: AgentContext): Set<string> {
  const ids = new Set<string>();
  for (const goal of context.activeGoals) ids.add(String(goal.id));
  if (context.relatedGoal?.id) ids.add(String(context.relatedGoal.id));
  return ids;
}

function countOnDate(context: AgentContext, dateKey: string, actions: ProposedAction[]): number {
  let count = 0;
  for (const list of [context.todayTasks, context.next7DaysTasks]) {
    count += list.filter((task) => String(task.dateKey) === dateKey).length;
  }
  for (const proposed of actions) {
    if (proposed.tool === "create_task" && proposed.args.dateKey === dateKey) count += 1;
    if (proposed.tool === "split_task") {
      const subtasks = (proposed.args.subtasks as Array<{ dateKey?: string }>) ?? [];
      count += subtasks.filter((subtask) => subtask.dateKey === dateKey).length;
    }
  }
  return count;
}

export interface ValidationResult {
  ok: boolean;
  output?: AgentOutput;
  failureReason?: string;
  errors?: string[];
}

export function extractAgentOutput(raw: string): unknown {
  return parseJson(raw);
}

export function validateAgentOutput(raw: string, context: AgentContext): ValidationResult {
  const parsed = parseJson(raw);
  if (!parsed) {
    return { ok: false, failureReason: "AGENT_OUTPUT_INVALID", errors: ["输出不是合法 JSON"] };
  }
  const topResult = outputSchema.safeParse(parsed);
  if (!topResult.success) {
    return {
      ok: false,
      failureReason: "AGENT_OUTPUT_INVALID",
      errors: topResult.error.issues.map((issue) => issue.message),
    };
  }
  const top = topResult.data;
  if (top.clarification_questions.length > 0 && top.proposed_actions.length > 0) {
    return {
      ok: false,
      failureReason: "AGENT_OUTPUT_INVALID",
      errors: ["澄清时不得生成 proposed_actions"],
    };
  }

  const knownTasks = taskIds(context);
  const knownGoals = goalIds(context);
  const actions: ProposedAction[] = [];
  const risks = [...top.risks];

  for (const rawAction of top.proposed_actions) {
    const action = rawAction as ProposedAction;
    if (!["create_task", "update_task", "move_task", "split_task"].includes(action.tool)) {
      return { ok: false, failureReason: "AGENT_TOOL_INVALID", errors: [`工具 ${action.tool} 非法`] };
    }
    if (
      typeof action.explanation !== "string" ||
      typeof action.confidence !== "number" ||
      !["low", "medium", "high"].includes(action.risk_level)
    ) {
      return {
        ok: false,
        failureReason: "AGENT_OUTPUT_INVALID",
        errors: ["动作缺少 explanation、confidence 或 risk_level"],
      };
    }
    if (action.confidence < 0 || action.confidence > 1) {
      return { ok: false, failureReason: "AGENT_OUTPUT_INVALID", errors: ["confidence 必须在 0 至 1"] };
    }

    let argsResult: z.SafeParseReturnType<unknown, unknown>;
    if (action.tool === "create_task") argsResult = createTaskSchema.safeParse(action.args);
    else if (action.tool === "update_task") argsResult = updateTaskSchema.safeParse(action.args);
    else if (action.tool === "move_task") argsResult = moveTaskSchema.safeParse(action.args);
    else argsResult = splitTaskSchema.safeParse(action.args);

    if (!argsResult.success) {
      return {
        ok: false,
        failureReason: "AGENT_OUTPUT_INVALID",
        errors: argsResult.error.issues.map((issue) => `${action.tool}: ${issue.message}`),
      };
    }

    const args = argsResult.data as Record<string, unknown>;
    if ("taskId" in args && !knownTasks.has(String(args.taskId))) {
      return {
        ok: false,
        failureReason: "RESOURCE_FORBIDDEN",
        errors: ["taskId 不属于当前用户或不存在"],
      };
    }
    if ("sourceTaskId" in args && !knownTasks.has(String(args.sourceTaskId))) {
      return {
        ok: false,
        failureReason: "RESOURCE_FORBIDDEN",
        errors: ["sourceTaskId 不属于当前用户或不存在"],
      };
    }
    if ("goalId" in args && args.goalId && !knownGoals.has(String(args.goalId))) {
      return {
        ok: false,
        failureReason: "RESOURCE_FORBIDDEN",
        errors: ["goalId 不属于当前用户 active 目标"],
      };
    }

    const finalAction = { ...action, args };
    if (finalAction.tool === "create_task") {
      const dateKey = String(finalAction.args.dateKey);
      if (countOnDate(context, dateKey, actions) > context.userPreferences.maxDailyTasks) {
        finalAction.risk_level = "high";
        risks.push(`${dateKey} 新增任务后超过 maxDailyTasks，需要用户确认。`);
      }
    }
    if (finalAction.tool === "split_task") {
      for (const subtask of (finalAction.args.subtasks as Array<{ dateKey: string }>) ?? []) {
        if (countOnDate(context, subtask.dateKey, actions) > context.userPreferences.maxDailyTasks) {
          finalAction.risk_level = "high";
          risks.push(`${subtask.dateKey} 子任务数量可能超过 maxDailyTasks。`);
        }
      }
    }
    actions.push(finalAction);
  }

  return {
    ok: true,
    output: { ...top, proposed_actions: actions, risks },
  };
}
