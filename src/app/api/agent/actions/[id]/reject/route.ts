import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { feedbackSchema } from "@/lib/schemas";
import { rejectAgentAction } from "@/lib/agent/action-approval.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = parseWithSchema(feedbackSchema, await readJson(request));
    return ok(
      await rejectAgentAction(user.id, id, {
        feedbackType: body.feedbackType,
        comment: body.comment,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
