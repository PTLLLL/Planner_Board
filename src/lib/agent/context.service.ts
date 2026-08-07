import { prisma } from "@/lib/db";
import { addDays, formatDateKey, parseDateKey, todayKey } from "@/lib/utils";
import { getOrCreatePreferences } from "@/lib/services/preference.service";
import type { AgentContext, AgentTrigger } from "@/lib/agent/types";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  dateKey: true,
  startTime: true,
  endTime: true,
  estimateMinutes: true,
  priority: true,
  isDone: true,
  goalId: true,
} as const;

function serializeTask(task: any) {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    dateKey: formatDateKey(task.dateKey),
    startTime: task.startTime ? task.startTime.toISOString().slice(11, 16) : null,
    endTime: task.endTime ? task.endTime.toISOString().slice(11, 16) : null,
    estimateMinutes: task.estimateMinutes ?? null,
    priority: task.priority,
    isDone: task.isDone,
    goalId: task.goalId ?? null,
  };
}

function serializeGoal(goal: any) {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description ?? "",
    targetDate: goal.targetDate ? formatDateKey(goal.targetDate) : null,
    taskTotal: goal._count?.tasks ?? 0,
    taskDone: goal._count?.tasksDone ?? 0,
  };
}

export async function buildAgentContext(
  userId: string,
  trigger: AgentTrigger,
): Promise<AgentContext> {
  const preferences = await getOrCreatePreferences(userId);
  const currentDate = todayKey(preferences.timezone);
  const from7 = addDays(currentDate, -7);
  const to7 = addDays(currentDate, 7);

  const [activeGoals, tasksInWindow, pendingActionsCount, relatedGoal, relatedTask] =
    await Promise.all([
      prisma.goal.findMany({
        where: { userId, status: "active", deletedAt: null },
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
        },
        take: 30,
      }),
      prisma.task.findMany({
        where: {
          userId,
          dateKey: { gte: parseDateKey(from7), lte: parseDateKey(to7) },
          deletedAt: null,
        },
        select: taskSelect,
        orderBy: { dateKey: "asc" },
        take: 500,
      }),
      prisma.agentAction.count({ where: { userId, status: "proposed" } }),
      trigger.relatedGoalId
        ? prisma.goal.findFirst({
            where: { id: trigger.relatedGoalId, userId, status: "active", deletedAt: null },
          })
        : null,
      trigger.relatedTaskId
        ? prisma.task.findFirst({
            where: { id: trigger.relatedTaskId, userId, deletedAt: null },
          })
        : null,
    ]);

  const tasks = tasksInWindow.map(serializeTask);
  const todayTasks = tasks.filter((t) => t.dateKey === currentDate);
  const next7DaysTasks = tasks.filter(
    (t) => t.dateKey >= currentDate && t.dateKey <= addDays(currentDate, 6),
  );
  const overdueUndoneTasks = tasks.filter(
    (t) => !t.isDone && t.dateKey < currentDate && t.dateKey >= from7,
  );

  const recent = tasks.filter((t) => t.dateKey <= currentDate && t.dateKey >= addDays(currentDate, -6));
  const doneCount = recent.filter((t) => t.isDone).length;
  const recentCompletionRate = recent.length ? Number((doneCount / recent.length).toFixed(2)) : 0;

  const overloadedDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(currentDate, index);
    const count = next7DaysTasks.filter((t) => t.dateKey === date).length;
    return count > preferences.maxDailyTasks ? date : null;
  }).filter(Boolean) as string[];

  return {
    currentDate,
    timezone: preferences.timezone,
    trigger: trigger.trigger,
    userPreferences: {
      maxDailyTasks: preferences.maxDailyTasks,
      workStartTime: preferences.workStartTime,
      workEndTime: preferences.workEndTime,
      preferredFocusTime: preferences.preferredFocusTime,
    },
    activeGoals: activeGoals.map(serializeGoal),
    todayTasks,
    next7DaysTasks,
    overdueUndoneTasks,
    recentCompletionRate,
    overloadedDays,
    pendingActionsCount,
    relatedGoal: relatedGoal ? serializeGoal({ ...relatedGoal, _count: { tasks: 0 } }) : null,
    relatedTask: relatedTask ? serializeTask(relatedTask) : null,
  };
}
