import { GoalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatDateKey, parseDateKey, toApiDate } from "@/lib/utils";
import { writeAuditLog } from "@/lib/services/audit.service";
import { emitServerEvent } from "@/lib/services/metrics.service";

function toGoalApi(goal: any) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    targetDate: toApiDate(goal.targetDate),
    status: goal.status,
    source: goal.source,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

export async function listGoals(userId: string, status?: string) {
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(status ? { status: status as GoalStatus } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return goals.map(toGoalApi);
}

async function getOwnedGoal(userId: string, id: string) {
  const goal = await prisma.goal.findFirst({
    where: { id, userId, deletedAt: null },
  });
  if (!goal) {
    throw new AppError("RESOURCE_NOT_FOUND", "目标不存在", 404);
  }
  return goal;
}

export async function createGoal(userId: string, input: { title: string; description?: string; targetDate?: string }) {
  const goal = await prisma.goal.create({
    data: {
      userId,
      title: input.title,
      description: input.description || null,
      targetDate: input.targetDate ? parseDateKey(input.targetDate) : null,
    },
  });
  await writeAuditLog({
    userId,
    entityType: "goal",
    entityId: goal.id,
    actionType: "create",
    afterState: toGoalApi(goal),
  });
  await emitServerEvent(userId, "goal_created", {
    goal_id: goal.id,
    source: "manual",
    has_target_date: Boolean(goal.targetDate),
  });
  return toGoalApi(goal);
}

export async function updateGoal(userId: string, id: string, input: Record<string, unknown>) {
  const existing = await getOwnedGoal(userId, id);
  const data: Record<string, unknown> = {};
  if ("title" in input) data.title = input.title;
  if ("description" in input) data.description = input.description || null;
  if ("targetDate" in input) data.targetDate = input.targetDate ? parseDateKey(String(input.targetDate)) : null;

  const goal = await prisma.goal.update({ where: { id }, data });
  await writeAuditLog({
    userId,
    entityType: "goal",
    entityId: goal.id,
    actionType: "update",
    beforeState: toGoalApi(existing),
    afterState: toGoalApi(goal),
  });
  await emitServerEvent(userId, "goal_updated", {
    goal_id: goal.id,
    changed_fields: Object.keys(data),
  });
  return toGoalApi(goal);
}

export async function completeGoal(userId: string, id: string) {
  const existing = await getOwnedGoal(userId, id);
  const goal = await prisma.goal.update({ where: { id }, data: { status: "completed" } });
  const taskStats = await prisma.task.aggregate({
    where: { goalId: id, deletedAt: null },
    _count: { _all: true },
  });
  const doneStats = await prisma.task.count({ where: { goalId: id, deletedAt: null, isDone: true } });
  await writeAuditLog({
    userId,
    entityType: "goal",
    entityId: goal.id,
    actionType: "update",
    beforeState: toGoalApi(existing),
    afterState: toGoalApi(goal),
  });
  await emitServerEvent(userId, "goal_completed", {
    goal_id: goal.id,
    related_task_count: taskStats._count._all,
    completed_task_count: doneStats,
  });
  return toGoalApi(goal);
}

export async function archiveGoal(userId: string, id: string) {
  const existing = await getOwnedGoal(userId, id);
  const goal = await prisma.goal.update({ where: { id }, data: { status: "archived" } });
  await writeAuditLog({
    userId,
    entityType: "goal",
    entityId: goal.id,
    actionType: "update",
    beforeState: toGoalApi(existing),
    afterState: toGoalApi(goal),
  });
  await emitServerEvent(userId, "goal_archived", { goal_id: goal.id });
  return toGoalApi(goal);
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await getOwnedGoal(userId, id);
  await prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAuditLog({
    userId,
    entityType: "goal",
    entityId: id,
    actionType: "delete",
    beforeState: toGoalApi(existing),
  });
  await emitServerEvent(userId, "goal_deleted", { goal_id: id, deletion_type: "soft_delete" });
}

export async function findActiveGoal(userId: string, id?: string) {
  if (!id) return null;
  return prisma.goal.findFirst({
    where: { id, userId, status: "active", deletedAt: null },
  });
}

export { toGoalApi, getOwnedGoal };
