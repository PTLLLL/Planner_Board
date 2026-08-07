import { Priority, TaskSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatTime, parseDateKey, parseTime, toApiDate } from "@/lib/utils";
import { writeAuditLog } from "@/lib/services/audit.service";
import { emitServerEvent } from "@/lib/services/metrics.service";

function toTaskApi(task: any) {
  return {
    id: task.id,
    goalId: task.goalId ?? null,
    title: task.title,
    description: task.description ?? "",
    dateKey: toApiDate(task.dateKey),
    startTime: formatTime(task.startTime),
    endTime: formatTime(task.endTime),
    estimateMinutes: task.estimateMinutes ?? null,
    priority: task.priority,
    isDone: task.isDone,
    completedAt: task.completedAt?.toISOString() ?? null,
    source: task.source,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export interface TaskFilters {
  fromDate?: string;
  toDate?: string;
  goalId?: string;
  isDone?: string;
  includeDeleted?: string;
}

export async function listTasks(userId: string, filters: TaskFilters = {}) {
  const where: Record<string, unknown> = {
    userId,
    ...(filters.includeDeleted !== "true" ? { deletedAt: null } : {}),
  };
  if (filters.fromDate) where.dateKey = { ...(where.dateKey as object), gte: parseDateKey(filters.fromDate) };
  if (filters.toDate) where.dateKey = { ...(where.dateKey as object), lte: parseDateKey(filters.toDate) };
  if (filters.goalId) where.goalId = filters.goalId;
  if (filters.isDone !== undefined) where.isDone = filters.isDone === "true";

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ dateKey: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
  });
  return tasks.map(toTaskApi);
}

export async function getOwnedTask(userId: string, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!task) {
    throw new AppError("RESOURCE_NOT_FOUND", "任务不存在", 404);
  }
  return task;
}

function buildTaskData(input: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if ("title" in input) data.title = input.title;
  if ("description" in input) data.description = input.description || null;
  if ("dateKey" in input) data.dateKey = parseDateKey(String(input.dateKey));
  if ("startTime" in input) data.startTime = input.startTime ? parseTime(String(input.startTime)) : null;
  if ("endTime" in input) data.endTime = input.endTime ? parseTime(String(input.endTime)) : null;
  if ("estimateMinutes" in input) data.estimateMinutes = input.estimateMinutes ?? null;
  if ("priority" in input) data.priority = input.priority;
  if ("goalId" in input) data.goalId = input.goalId || null;
  return data;
}

export async function createTask(
  userId: string,
  input: Record<string, unknown>,
  source: TaskSource = "manual",
  agentActionId?: string | null,
) {
  const data = buildTaskData(input);
  const task = await prisma.task.create({
    data: {
      userId,
      title: String(data.title),
      dateKey: (data.dateKey as Date) ?? parseDateKey(String(input.dateKey)),
      description: (data.description as string | null) ?? null,
      startTime: (data.startTime as Date | null) ?? null,
      endTime: (data.endTime as Date | null) ?? null,
      estimateMinutes: (data.estimateMinutes as number | null) ?? null,
      priority: (data.priority as Priority) ?? "medium",
      goalId: (data.goalId as string | null) ?? null,
      source,
      agentActionId: agentActionId ?? null,
    },
  });
  await writeAuditLog({
    userId,
    agentActionId,
    entityType: "task",
    entityId: task.id,
    actionType: "create",
    afterState: toTaskApi(task),
  });
  await emitServerEvent(userId, "task_created", {
    task_id: task.id,
    source,
    date_key: toApiDate(task.dateKey),
    priority: task.priority,
    has_goal: Boolean(task.goalId),
    estimate_minutes: task.estimateMinutes,
  });
  return toTaskApi(task);
}

export async function updateTask(userId: string, id: string, input: Record<string, unknown>, sourceOfChange = "manual") {
  const existing = await getOwnedTask(userId, id);
  const data = buildTaskData(input);
  const task = await prisma.task.update({ where: { id }, data });
  await writeAuditLog({
    userId,
    entityType: "task",
    entityId: task.id,
    actionType: "update",
    beforeState: toTaskApi(existing),
    afterState: toTaskApi(task),
  });
  await emitServerEvent(userId, "task_updated", {
    task_id: task.id,
    changed_fields: Object.keys(data),
    source_of_change: sourceOfChange,
  });
  return toTaskApi(task);
}

export async function completeTask(userId: string, id: string, sourceOfChange = "manual") {
  const existing = await getOwnedTask(userId, id);
  const task = await prisma.task.update({
    where: { id },
    data: { isDone: true, completedAt: new Date() },
  });
  await writeAuditLog({
    userId,
    entityType: "task",
    entityId: task.id,
    actionType: "complete",
    beforeState: toTaskApi(existing),
    afterState: toTaskApi(task),
  });
  await emitServerEvent(userId, "task_completed", {
    task_id: task.id,
    date_key: toApiDate(task.dateKey),
    age_days: Math.max(0, Math.floor((Date.now() - task.dateKey.getTime()) / 86400000)),
    source: sourceOfChange,
  });
  return toTaskApi(task);
}

export async function uncompleteTask(userId: string, id: string) {
  const existing = await getOwnedTask(userId, id);
  const task = await prisma.task.update({
    where: { id },
    data: { isDone: false, completedAt: null },
  });
  await writeAuditLog({
    userId,
    entityType: "task",
    entityId: task.id,
    actionType: "uncomplete",
    beforeState: toTaskApi(existing),
    afterState: toTaskApi(task),
  });
  await emitServerEvent(userId, "task_uncompleted", {
    task_id: task.id,
    date_key: toApiDate(task.dateKey),
  });
  return toTaskApi(task);
}

export async function moveTask(userId: string, id: string, newDateKey: string, sourceOfChange = "manual") {
  const existing = await getOwnedTask(userId, id);
  const task = await prisma.task.update({
    where: { id },
    data: { dateKey: parseDateKey(newDateKey) },
  });
  await writeAuditLog({
    userId,
    entityType: "task",
    entityId: task.id,
    actionType: "move",
    beforeState: toTaskApi(existing),
    afterState: toTaskApi(task),
  });
  await emitServerEvent(userId, "task_moved", {
    task_id: task.id,
    from_date_key: toApiDate(existing.dateKey),
    to_date_key: newDateKey,
    source_of_change: sourceOfChange,
  });
  return toTaskApi(task);
}

export async function deleteTask(userId: string, id: string) {
  const existing = await getOwnedTask(userId, id);
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    userId,
    entityType: "task",
    entityId: id,
    actionType: "delete",
    beforeState: toTaskApi(existing),
  });
  await emitServerEvent(userId, "task_deleted", {
    task_id: id,
    deletion_type: "soft_delete",
    source_of_change: "manual",
  });
}

export { toTaskApi };
