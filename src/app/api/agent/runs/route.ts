import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { listAgentRuns } from "@/lib/agent/orchestrator.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request, { csrf: false });
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 20);
    return ok(await listAgentRuns(user.id, { status, page, pageSize }));
  } catch (error) {
    return fail(error);
  }
}
