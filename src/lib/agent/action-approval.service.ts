import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { buildAgentContext } from "@/lib/agent/context.service";
import { validateAgentOutput } from "@/lib/agent/output-validator";
import { executeAgentAction } from "@/lib/agent/tool-executor.service";
import { emitServerEvent } from "@/lib/services/metrics.service";
import { formatDateKey } from "@/lib/utils";

const actionInclude = {
  agentRun: {
    select: {
      id: true,
      requestText: true,
      promptVersion: true,
      createdAt: true,
    },
  },
} as const;

function serializeAction(action: any) {
  return {
    id: action.id,
    agentRunId: action.agentRunId,
    tool: action.tool,
    originalArgs: action.originalArgs,
    editedArgs: action.editedArgs,
    explanation: action.explanation,
    confidence: action.confidence,
    riskLevel: action.riskLevel,
    status: action.status,
    resultEntityType: action.resultEntityType,
    resultEntityId: action.resultEntityId,
    failureReason: action.failureReason,
    expiresAt: action.expiresAt.toISOString(),
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    run: action.agentRun
      ? {
          id: action.agentRun.id,
          requestText: action.agentRun.requestText,
          promptVersion: action.agentRun.promptVersion,
          createdAt: action.agentRun.createdAt.toISOString(),
        }
      : null,
  };
}

export async function expireProposedActions(userId: string) {
  await prisma.agentAction.updateMany({
    where: { userId, status: "proposed", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
}

export async function listAgentActions(
  userId: string,
  options: { runId?: string; status?: string; page?: number; pageSize?: number } = {},
) {
  await expireProposedActions(userId);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const where = {
    userId,
    ...(options.runId ? { agentRunId: options.runId } : {}),
    ...(options.status ? { status: options.status as never } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.agentAction.count({ where }),
    prisma.agentAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: actionInclude,
    }),
  ]);
  return { items: items.map(serializeAction), page, pageSize, total };
}

async function getAction(userId: string, actionId: string) {
  const action = await prisma.agentAction.findFirst({
    where: { id: actionId, userId },
    include: actionInclude,
  });
  if (!action) throw new AppError("RESOURCE_NOT_FOUND", "建议不存在", 404);
  return action;
}

async function validateArgs(userId: string, tool: string, args: Record<string, unknown>) {
  const taskIds = [
    args.taskId,
    args.sourceTaskId,
    ...((args.subtasks as Array<{ taskId?: string }> | undefined)?.flatMap((item) => item.taskId ? [item.taskId] : []) ?? []),
  ].filter(Boolean) as string[];
  const goalIds = [args.goalId, ...((args.subtasks as Array<{ goalId?: string }> | undefined)?.flatMap((item) => item.goalId ? [item.goalId] : []) ?? [])].filter(Boolean) as string[];

  const [ownedTasks, ownedGoals] = await Promise.all([
    taskIds.length
      ? prisma.task.findMany({ where: { id: { in: taskIds }, userId, deletedAt: null } })
      : [],
    goalIds.length
      ? prisma.goal.findMany({ where: { id: { in: goalIds }, userId, status: "active", deletedAt: null } })
      : [],
  ]);
  if (taskIds.length && ownedTasks.length !== taskIds.length) {
    throw new AppError("RESOURCE_FORBIDDEN", "任务不存在或不属于当前用户", 403);
  }
  if (goalIds.length && ownedGoals.length !== goalIds.length) {
    throw new AppError("RESOURCE_FORBIDDEN", "目标不存在或不是 active 状态", 403);
  }

  const context = await buildAgentContext(userId, {
    requestText: "validate",
    trigger: "agent_input",
  });
  if (ownedTasks[0]) {
    const serialized = {
      id: ownedTasks[0].id,
      title: ownedTasks[0].title,
      dateKey: formatDateKey(ownedTasks[0].dateKey),
      priority: ownedTasks[0].priority,
      isDone: ownedTasks[0].isDone,
      goalId: ownedTasks[0].goalId,
    };
    context.todayTasks.push(serialized);
    context.next7DaysTasks.push(serialized);
    context.overdueUndoneTasks.push(serialized);
  }
  if (ownedGoals[0]) {
    context.activeGoals.push({
      id: ownedGoals[0].id,
      title: ownedGoals[0].title,
      description: ownedGoals[0].description ?? "",
      targetDate: ownedGoals[0].targetDate ? formatDateKey(ownedGoals[0].targetDate) : null,
      taskTotal: 0,
      taskDone: 0,
    });
  }
  const sample = {
    summary: "校验动作",
    clarification_questions: [],
    proposed_actions: [
      {
        tool,
        args,
        explanation: "校验动作",
        confidence: 0.9,
        risk_level: "medium",
      },
    ],
    risks: [],
    overall_confidence: 0.9,
  };
  const result = validateAgentOutput(JSON.stringify(sample), context);
  if (!result.ok) {
    throw new AppError(
      result.failureReason ?? "AGENT_OUTPUT_INVALID",
      result.errors?.join("；") || "动作参数校验失败",
      400,
    );
  }
  return result.output!.proposed_actions[0]!;
}

export async function approveAgentAction(
  userId: string,
  actionId: string,
  subtaskIndices?: number[],
) {
  await expireProposedActions(userId);
  const action = await getAction(userId, actionId);
  if (action.status !== "proposed") {
    throw new AppError("AGENT_ACTION_EXPIRED", "建议已处理或已过期，不能再次执行", 409);
  }
  const args = (action.editedArgs ?? action.originalArgs) as Record<string, unknown>;
  const validated = await validateArgs(userId, action.tool, args);
  const effectiveArgs = validated.args;

  await prisma.agentAction.update({
    where: { id: action.id },
    data: { status: "approved" },
  });

  try {
    const result = await executeAgentAction(
      userId,
      action.id,
      action.tool,
      effectiveArgs,
      subtaskIndices,
    );
    await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: "executed",
        resultEntityType: result.resultEntityType,
        resultEntityId: result.resultEntityId,
      },
    });
    await emitServerEvent(userId, "agent_action_executed", {
      action_id: action.id,
      tool: action.tool,
      result_entity_type: result.resultEntityType,
      result_entity_id: result.resultEntityId,
      latency_ms: 0,
    });
    return serializeAction(
      await prisma.agentAction.findUnique({ where: { id: action.id }, include: actionInclude }),
    );
  } catch (error) {
    const reason = error instanceof AppError ? error.message : "执行失败";
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: "failed", failureReason: reason },
    });
    await emitServerEvent(userId, "agent_action_failed", {
      action_id: action.id,
      tool: action.tool,
      failure_reason: reason,
    });
    throw new AppError("AGENT_ACTION_EXECUTION_FAILED", reason, 400);
  }
}

export async function rejectAgentAction(
  userId: string,
  actionId: string,
  input?: { feedbackType?: string; comment?: string },
) {
  await expireProposedActions(userId);
  const action = await getAction(userId, actionId);
  if (action.status !== "proposed") {
    throw new AppError("AGENT_ACTION_EXPIRED", "建议已处理或已过期", 409);
  }
  await prisma.agentAction.update({ where: { id: action.id }, data: { status: "rejected" } });
  if (input?.feedbackType) {
    await prisma.feedbackEvent.create({
      data: {
        userId,
        agentActionId: action.id,
        feedbackType: input.feedbackType as never,
        comment: input.comment || null,
      },
    });
  }
  await emitServerEvent(userId, "agent_action_rejected", {
    action_id: action.id,
    tool: action.tool,
    feedback_type: input?.feedbackType ?? null,
    time_to_decision_seconds: Math.round(
      (Date.now() - action.createdAt.getTime()) / 1000,
    ),
  });
  return serializeAction(action);
}

export async function editAgentAction(userId: string, actionId: string, args: Record<string, unknown>) {
  await expireProposedActions(userId);
  const action = await getAction(userId, actionId);
  if (action.status !== "proposed") {
    throw new AppError("AGENT_ACTION_EXPIRED", "只有待确认建议可以编辑", 409);
  }
  if (action.tool === "split_task") {
    throw new AppError("AGENT_ACTION_NOT_EDITABLE", "split_task 不支持整体编辑", 400);
  }
  const validated = await validateArgs(userId, action.tool, args);
  const updated = await prisma.agentAction.update({
    where: { id: action.id },
    data: { editedArgs: validated.args as Prisma.InputJsonValue },
  });
  return serializeAction(updated);
}

export async function submitFeedback(
  userId: string,
  actionId: string,
  feedbackType: string,
  comment?: string,
) {
  const action = await getAction(userId, actionId);
  await prisma.feedbackEvent.create({
    data: {
      userId,
      agentActionId: action.id,
      feedbackType: feedbackType as never,
      comment: comment || null,
    },
  });
  await emitServerEvent(userId, "feedback_submitted", {
    action_id: action.id,
    feedback_type: feedbackType,
    has_comment: Boolean(comment),
  });
}
