import { NextRequest } from "next/server";
import { fail, ok, requireUser } from "@/lib/api";
import { getEvalSummary } from "@/lib/services/eval.service";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, { csrf: false });
    return ok(await getEvalSummary());
  } catch (error) {
    return fail(error);
  }
}
