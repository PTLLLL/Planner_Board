import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { agentActionEditSchema } from "@/lib/schemas";
import { editAgentAction } from "@/lib/agent/action-approval.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(agentActionEditSchema, await readJson(request));
    return ok(await editAgentAction(user.id, id, body.args));
  } catch (error) {
    return fail(error);
  }
}
