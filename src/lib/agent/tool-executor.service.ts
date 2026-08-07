import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatTime, parseDateKey, parseTime, toApiDate } from "@/lib/utils";
import { toTaskApi } from "@/lib/services/task.service";

interface ExecutorResult {
  resultEntityType: string;
  resultEntityId: string | null;
  createdIds: string[];
}

function buildData(args: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in args) data.title = args.title;
  if ("description" in args) data.description = args.description || null;
  if ("dateKey" in args) data.dateKey = parseDateKey(String(args.dateKey));
  if ("startTime" in args) data.startTime = args.startTime ? parseTime(String(args.startTime)) : null;
  if ("endTime" in args) data.endTime = args.endTime ? parseTime(String(args.endTime)) : null;
  if ("estimateMinutes" in args) data.estimateMinutes = args.estimateMinutes ?? null;
  if ("priority" in args) data.priority = args.priority;
  if ("goalId" in args) data.goalId = args.goalId || null;
  return data;
}

export async function executeAgentAction(
  userId: string,
  actionId: string,
  tool: string,
  args: Record<string, unknown>,
  subtaskIndices?: number[],
): Promise<ExecutorResult> {
  return prisma.$transaction(async (tx) => {
    await tx.agentAction.update({
      where: { id: actionId },
      data: { status: "executing" },
    });

    const result: ExecutorResult = {
      resultEntityType: "task",
      resultEntityId: null,
      createdIds: [],
    };

    if (tool === "create_task") {
      const task = await tx.task.create({
        data: {
          userId,
          title: String(args.title),
          description: (args.description as string) || null,
          dateKey: parseDateKey(String(args.dateKey)),
          startTime: args.startTime ? parseTime(String(args.startTime)) : null,
          endTime: args.endTime ? parseTime(String(args.endTime)) : null,
          estimateMinutes: (args.estimateMinutes as number) ?? null,
          priority: (args.priority as never) ?? "medium",
          goalId: (args.goalId as string) || null,
          source: "agent",
          agentActionId: actionId,
        },
      });
      result.resultEntityId = task.id;
      result.createdIds.push(task.id);
      await tx.actionLog.create({
        data: {
          userId,
          agentActionId: actionId,
          entityType: "task",
          entityId: task.id,
          actionType: "create",
          afterState: toTaskApi(task) as object,
        },
      });
    } else if (tool === "update_task") {
      const existing = await tx.task.findFirst({
        where: { id: String(args.taskId), userId, deletedAt: null },
      });
      if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "任务不存在", 404);
      const task = await tx.task.update({
        where: { id: existing.id },
        data: buildData(args),
      });
      result.resultEntityId = task.id;
      result.createdIds.push(task.id);
      await tx.actionLog.create({
        data: {
          userId,
          agentActionId: actionId,
          entityType: "task",
          entityId: task.id,
          actionType: "update",
          beforeState: toTaskApi(existing) as object,
          afterState: toTaskApi(task) as object,
        },
      });
    } else if (tool === "move_task") {
      const existing = await tx.task.findFirst({
        where: { id: String(args.taskId), userId, deletedAt: null },
      });
      if (!existing) throw new AppError("RESOURCE_NOT_FOUND", "任务不存在", 404);
      const task = await tx.task.update({
        where: { id: existing.id },
        data: { dateKey: parseDateKey(String(args.newDateKey)) },
      });
      result.resultEntityId = task.id;
      result.createdIds.push(task.id);
      await tx.actionLog.create({
        data: {
          userId,
          agentActionId: actionId,
          entityType: "task",
          entityId: task.id,
          actionType: "move",
          beforeState: toTaskApi(existing) as object,
          afterState: toTaskApi(task) as object,
        },
      });
    } else if (tool === "split_task") {
      const source = await tx.task.findFirst({
        where: { id: String(args.sourceTaskId), userId, deletedAt: null },
      });
      if (!source) throw new AppError("RESOURCE_NOT_FOUND", "原任务不存在", 404);
      const subtasks = (args.subtasks as Array<Record<string, unknown>>) ?? [];
      const selected = subtaskIndices
        ? subtasks.filter((_, index) => subtaskIndices.includes(index))
        : subtasks;
      for (const subtask of selected) {
        const task = await tx.task.create({
          data: {
            userId,
            title: String(subtask.title),
            description: null,
            dateKey: parseDateKey(String(subtask.dateKey)),
            estimateMinutes: (subtask.estimateMinutes as number) ?? null,
            priority: (subtask.priority as never) ?? "medium",
            goalId: (subtask.goalId as string) || source.goalId || null,
            source: "agent",
            agentActionId: actionId,
          },
        });
        result.resultEntityId ??= task.id;
        result.createdIds.push(task.id);
        await tx.actionLog.create({
          data: {
            userId,
            agentActionId: actionId,
            entityType: "task",
            entityId: task.id,
            actionType: "split",
            afterState: toTaskApi(task) as object,
          },
        });
      }
    } else {
      throw new AppError("AGENT_TOOL_INVALID", "不支持的 Agent 工具", 400);
    }

    return result;
  });
}

export { formatTime, toApiDate };
