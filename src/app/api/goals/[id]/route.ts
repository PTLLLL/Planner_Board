import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { goalUpdateSchema } from "@/lib/schemas";
import { deleteGoal, updateGoal } from "@/lib/services/goal.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(goalUpdateSchema, await readJson(request));
    const goal = await updateGoal(user.id, id, body as Record<string, unknown>);
    return ok(goal);
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
    await deleteGoal(user.id, id);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
