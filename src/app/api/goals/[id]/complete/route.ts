import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { completeGoal } from "@/lib/services/goal.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await completeGoal(user.id, id));
  } catch (error) {
    return fail(error);
  }
}
