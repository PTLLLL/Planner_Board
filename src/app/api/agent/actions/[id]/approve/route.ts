import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { agentActionApproveSchema } from "@/lib/schemas";
import { approveAgentAction } from "@/lib/agent/action-approval.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(agentActionApproveSchema, await readJson(request));
    return ok(await approveAgentAction(user.id, id, body.subtaskIndices));
  } catch (error) {
    return fail(error);
  }
}
