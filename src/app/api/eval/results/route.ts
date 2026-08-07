import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { listEvalResults } from "@/lib/services/eval.service";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, { csrf: false });
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? undefined;
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 20);
    return ok(await listEvalResults({ category, page, pageSize }));
  } catch (error) {
    return fail(error);
  }
}
