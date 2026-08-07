import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { emitServerEvent } from "@/lib/services/metrics.service";

export const DEFAULT_PREFERENCES = {
  timezone: "Asia/Shanghai",
  maxDailyTasks: 5,
  workStartTime: "09:00",
  workEndTime: "22:00",
  preferredFocusTime: "morning",
  requireConfirmation: true,
};

export async function getOrCreatePreferences(userId: string) {
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userPreference.create({
    data: { userId, ...DEFAULT_PREFERENCES },
  });
}

export async function updatePreferences(userId: string, data: Record<string, unknown>) {
  const allowed = ["timezone", "maxDailyTasks", "workStartTime", "workEndTime", "preferredFocusTime"];
  const changes = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  if (Object.keys(changes).length === 0) {
    throw new AppError("VALIDATION_ERROR", "没有可更新的偏好字段", 400);
  }
  const updated = await prisma.userPreference.update({
    where: { userId },
    data: { ...changes, requireConfirmation: true },
  });
  await emitServerEvent(userId, "preferences_updated", { changed_fields: Object.keys(changes) });
  return updated;
}
