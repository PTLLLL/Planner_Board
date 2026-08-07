import { prisma } from "@/lib/db";
import { addDays, formatDateKey, parseDateKey, todayKey } from "@/lib/utils";
import { getOrCreatePreferences } from "@/lib/services/preference.service";

export async function getTodayOverview(userId: string) {
  const preferences = await getOrCreatePreferences(userId);
  const today = todayKey(preferences.timezone);
  const tasks = await prisma.task.findMany({
    where: { userId, dateKey: parseDateKey(today), deletedAt: null },
  });
  const total = tasks.length;
  const done = tasks.filter((t) => t.isDone).length;
  const estimateTotal = tasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);
  const highPriority = tasks.filter((t) => t.priority === "high" && !t.isDone).length;
  return {
    date: today,
    total,
    done,
    completionRate: total ? Number((done / total).toFixed(2)) : 0,
    estimateTotal,
    highPriority,
    maxDailyTasks: preferences.maxDailyTasks,
  };
}

export async function getWeeklyLoad(userId: string) {
  const preferences = await getOrCreatePreferences(userId);
  const today = todayKey(preferences.timezone);
  const to = addDays(today, 6);
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      dateKey: { gte: parseDateKey(today), lte: parseDateKey(to) },
      deletedAt: null,
    },
    select: { dateKey: true, estimateMinutes: true, isDone: true, priority: true },
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index);
    const dayTasks = tasks.filter((t) => formatDateKey(t.dateKey) === date);
    const estimateTotal = dayTasks.reduce((sum, t) => sum + (t.estimateMinutes ?? 0), 0);
    return {
      date,
      taskCount: dayTasks.length,
      estimateTotal,
      overloaded: dayTasks.length > preferences.maxDailyTasks,
      timeOverloaded: estimateTotal > 480,
    };
  });
  return {
    days,
    overloadedCount: days.filter((d) => d.overloaded || d.timeOverloaded).length,
    maxDailyTasks: preferences.maxDailyTasks,
  };
}

export async function getGoalProgress(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId, status: "active", deletedAt: null },
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { id: true, isDone: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return goals.map((goal) => {
    const total = goal.tasks.length;
    const done = goal.tasks.filter((t) => t.isDone).length;
    return {
      id: goal.id,
      title: goal.title,
      targetDate: goal.targetDate ? formatDateKey(goal.targetDate) : null,
      taskTotal: total,
      taskDone: done,
      completionRate: total ? Number((done / total).toFixed(2)) : 0,
    };
  });
}

export async function getAgentSummary(userId: string) {
  const [pendingCount, latestRun, recentActions] = await Promise.all([
    prisma.agentAction.count({ where: { userId, status: "proposed" } }),
    prisma.agentRun.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, requestText: true, promptVersion: true },
    }),
    prisma.agentAction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, tool: true, status: true, explanation: true, createdAt: true },
    }),
  ]);
  return {
    pendingCount,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          createdAt: latestRun.createdAt.toISOString(),
          requestText: latestRun.requestText,
          promptVersion: latestRun.promptVersion,
        }
      : null,
    recentActions: recentActions.map((action) => ({
      id: action.id,
      tool: action.tool,
      status: action.status,
      explanation: action.explanation,
      createdAt: action.createdAt.toISOString(),
    })),
  };
}
