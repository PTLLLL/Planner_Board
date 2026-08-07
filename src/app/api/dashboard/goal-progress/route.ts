import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { getGoalProgress } from "@/lib/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    return ok(await getGoalProgress(user.id));
  } catch (error) {
    return fail(error);
  }
}
