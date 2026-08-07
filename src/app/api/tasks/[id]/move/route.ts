import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { moveTaskSchema } from "@/lib/schemas";
import { moveTask } from "@/lib/services/task.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(moveTaskSchema, await readJson(request));
    return ok(await moveTask(user.id, id, body.newDateKey));
  } catch (error) {
    return fail(error);
  }
}
