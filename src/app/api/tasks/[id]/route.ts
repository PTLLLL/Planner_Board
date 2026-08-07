import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/schemas";
import { deleteTask, updateTask } from "@/lib/services/task.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(taskUpdateSchema, await readJson(request));
    const task = await updateTask(user.id, id, body as Record<string, unknown>);
    return ok(task);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    await deleteTask(user.id, id);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
