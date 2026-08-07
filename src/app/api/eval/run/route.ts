import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { evalRunSchema } from "@/lib/schemas";
import { runEval } from "@/lib/services/eval.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const allowed = await rateLimitCheck("eval-run", user.id, 5, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "评估运行过于频繁，请稍后再试", 429);
    const body = parseWithSchema(evalRunSchema, await readJson(request));
    return ok(await runEval(user.id, body), 201);
  } catch (error) {
    return fail(error);
  }
}
