import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { getAgentRunDetail } from "@/lib/agent/orchestrator.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request, { csrf: false });
    const { id } = await params;
    return ok(await getAgentRunDetail(user.id, id));
  } catch (error) {
    return fail(error);
  }
}
