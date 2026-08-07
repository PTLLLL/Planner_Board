import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { goalCreateSchema } from "@/lib/schemas";
import { createGoal, listGoals } from "@/lib/services/goal.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const goals = await listGoals(user.id, status);
    return ok(goals);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(goalCreateSchema, await readJson(request));
    const goal = await createGoal(user.id, body);
    return ok(goal, 201);
  } catch (error) {
    return fail(error);
  }
}
