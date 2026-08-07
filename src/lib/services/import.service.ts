import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { parseDateKey } from "@/lib/utils";
import { emitServerEvent } from "@/lib/services/metrics.service";

interface LegacyData {
  focuses: Array<{ id?: string; text: string; done?: boolean }>;
  days: Record<string, Array<{ id?: string; text: string; done?: boolean }>>;
}

interface ImportReport {
  goalsCreated: number;
  goalsSkipped: number;
  tasksCreated: number;
  tasksSkipped: number;
  failures: string[];
}

async function existingKeys(userId: string) {
  const [goals, tasks] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, deletedAt: null },
      select: { legacyId: true, title: true },
    }),
    prisma.task.findMany({
      where: { userId, deletedAt: null },
      select: { legacyId: true, dateKey: true, title: true, isDone: true },
    }),
  ]);
  return {
    goals,
    tasks: tasks.map((task) => ({
      ...task,
      dateKey: task.dateKey.toISOString().slice(0, 10),
    })),
  };
}

function goalDuplicate(goal: { legacyId?: string; text: string }, existing: Array<{ legacyId: string | null; title: string }>) {
  return existing.some(
    (item) =>
      (goal.legacyId && item.legacyId === goal.legacyId) ||
      (!goal.legacyId && item.title === goal.text),
  );
}

function taskDuplicate(
  task: { legacyId?: string; text: string; done?: boolean },
  dateKey: string,
  existing: Array<{ legacyId: string | null; dateKey: string; title: string; isDone: boolean }>,
) {
  return existing.some(
    (item) =>
      item.dateKey === dateKey &&
      item.title === task.text &&
      (task.legacyId ? item.legacyId === task.legacyId : item.isDone === Boolean(task.done)),
  );
}

export async function previewImport(userId: string, data: LegacyData): Promise<ImportReport> {
  const existing = await existingKeys(userId);
  const report: ImportReport = { goalsCreated: 0, goalsSkipped: 0, tasksCreated: 0, tasksSkipped: 0, failures: [] };
  for (const focus of data.focuses) {
    if (goalDuplicate(focus, existing.goals)) report.goalsSkipped += 1;
    else report.goalsCreated += 1;
  }
  for (const [dateKey, items] of Object.entries(data.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      report.failures.push(`非法日期：${dateKey}`);
      continue;
    }
    for (const item of items) {
      if (taskDuplicate(item, dateKey, existing.tasks)) report.tasksSkipped += 1;
      else report.tasksCreated += 1;
    }
  }
  return report;
}

export async function executeImport(userId: string, data: LegacyData): Promise<ImportReport> {
  return prisma.$transaction(async (tx) => {
    const report: ImportReport = { goalsCreated: 0, goalsSkipped: 0, tasksCreated: 0, tasksSkipped: 0, failures: [] };
    for (const focus of data.focuses) {
      const duplicate = await tx.goal.findFirst({
        where: {
          userId,
          deletedAt: null,
          OR: [
            ...(focus.id ? [{ legacyId: focus.id }] : []),
            { title: focus.text },
          ],
        },
      });
      if (duplicate) {
        report.goalsSkipped += 1;
        continue;
      }
      await tx.goal.create({
        data: {
          userId,
          title: focus.text,
          description: null,
          status: focus.done ? "completed" : "active",
          source: "imported",
          legacyId: focus.id ?? null,
        },
      });
      report.goalsCreated += 1;
    }

    for (const [dateKey, items] of Object.entries(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        report.failures.push(`非法日期：${dateKey}`);
        continue;
      }
      const date = parseDateKey(dateKey);
      for (const item of items) {
        const duplicate = await tx.task.findFirst({
          where: {
            userId,
            deletedAt: null,
            dateKey: date,
            title: item.text,
            ...(item.id ? { legacyId: item.id } : { isDone: Boolean(item.done) }),
          },
        });
        if (duplicate) {
          report.tasksSkipped += 1;
          continue;
        }
        await tx.task.create({
          data: {
            userId,
            title: item.text,
            dateKey: date,
            isDone: Boolean(item.done),
            completedAt: item.done ? new Date() : null,
            source: "imported",
            legacyId: item.id ?? null,
          },
        });
        report.tasksCreated += 1;
      }
    }

    if (report.failures.length > 0) {
      throw new AppError("IMPORT_INVALID_SCHEMA", "导入数据存在非法项，已整体回滚", 400, { failures: report.failures });
    }

    await tx.actionLog.create({
      data: {
        userId,
        agentActionId: null,
        entityType: "import",
        entityId: null,
        actionType: "import",
        beforeState: undefined,
        afterState: report as unknown as Prisma.InputJsonValue,
      },
    });
    await emitServerEvent(userId, "import_executed", {
      success: true,
      goals_created: report.goalsCreated,
      goals_skipped: report.goalsSkipped,
      tasks_created: report.tasksCreated,
      tasks_skipped: report.tasksSkipped,
      failure_count: report.failures.length,
    });
    return report;
  });
}
