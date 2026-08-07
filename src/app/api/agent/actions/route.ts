import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { listAgentActions } from "@/lib/agent/action-approval.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 20);
    return ok(await listAgentActions(user.id, { runId, status, page, pageSize }));
  } catch (error) {
    return fail(error);
  }
}
