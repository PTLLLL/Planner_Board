import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { updateProfileSchema } from "@/lib/schemas";
import { getUserById, updateDisplayName } from "@/lib/services/auth.service";
import { getOrCreatePreferences } from "@/lib/services/preference.service";
import { ensureCsrfToken } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const [profile, preferences, csrfToken] = await Promise.all([
      getUserById(user.id),
      getOrCreatePreferences(user.id),
      ensureCsrfToken(),
    ]);
    return ok({
      user: {
        id: profile?.id,
        email: profile?.email,
        displayName: profile?.displayName,
      },
      preferences: {
        timezone: preferences.timezone,
        maxDailyTasks: preferences.maxDailyTasks,
        workStartTime: preferences.workStartTime,
        workEndTime: preferences.workEndTime,
        preferredFocusTime: preferences.preferredFocusTime,
        requireConfirmation: preferences.requireConfirmation,
      },
      csrfToken,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(updateProfileSchema, await readJson(request));
    const updated = await updateDisplayName(user.id, body.displayName);
    return ok({ user: { id: updated.id, email: updated.email, displayName: updated.displayName } });
  } catch (error) {
    return fail(error);
  }
}
