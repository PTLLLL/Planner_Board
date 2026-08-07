import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { taskCreateSchema } from "@/lib/schemas";
import { createTask, listTasks } from "@/lib/services/task.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const url = new URL(request.url);
    const tasks = await listTasks(user.id, {
      fromDate: url.searchParams.get("fromDate") ?? undefined,
      toDate: url.searchParams.get("toDate") ?? undefined,
      goalId: url.searchParams.get("goalId") ?? undefined,
      isDone: url.searchParams.get("isDone") ?? undefined,
      includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
    });
    return ok(tasks);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = parseWithSchema(taskCreateSchema, await readJson(request));
    const task = await createTask(user.id, body as Record<string, unknown>, "manual");
    return ok(task, 201);
  } catch (error) {
    return fail(error);
  }
}
