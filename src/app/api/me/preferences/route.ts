import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { preferenceSchema } from "@/lib/schemas";
import { getOrCreatePreferences, updatePreferences } from "@/lib/services/preference.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const preferences = await getOrCreatePreferences(user.id);
    return ok({
      timezone: preferences.timezone,
      maxDailyTasks: preferences.maxDailyTasks,
      workStartTime: preferences.workStartTime,
      workEndTime: preferences.workEndTime,
      preferredFocusTime: preferences.preferredFocusTime,
      requireConfirmation: preferences.requireConfirmation,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(preferenceSchema, await readJson(request));
    const updated = await updatePreferences(user.id, body as Record<string, unknown>);
    return ok({
      timezone: updated.timezone,
      maxDailyTasks: updated.maxDailyTasks,
      workStartTime: updated.workStartTime,
      workEndTime: updated.workEndTime,
      preferredFocusTime: updated.preferredFocusTime,
      requireConfirmation: updated.requireConfirmation,
    });
  } catch (error) {
    return fail(error);
  }
}
