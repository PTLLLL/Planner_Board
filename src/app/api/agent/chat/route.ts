import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { agentChatSchema } from "@/lib/schemas";
import { runAgent } from "@/lib/agent/orchestrator.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const allowed = await rateLimitCheck("agent-chat", user.id, 20, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Agent 请求过于频繁，请稍后再试", 429);
    const body = parseWithSchema(agentChatSchema, await readJson(request));
    const run = await runAgent(user.id, body);
    return ok(run, 201);
  } catch (error) {
    return fail(error);
  }
}
