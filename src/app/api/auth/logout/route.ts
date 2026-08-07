import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { clearSessionCookie, getSessionUser } from "@/lib/auth/session";
import { emitServerEvent } from "@/lib/services/metrics.service";

export async function POST(_request: NextRequest) {
  try {
    const user = await getSessionUser();
    await clearSessionCookie();
    await emitServerEvent(user?.id ?? null, "user_logged_out");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
