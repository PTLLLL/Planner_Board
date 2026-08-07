import { NextRequest } from "next/server";
import { fail, ok, parseWithSchema, readJson, requireUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { agentChatSchema } from "@/lib/schemas";
import { runAgent } from "@/lib/agent/orchestrator.service";
import { rateLimitCheck } from "@/lib/services/rate-limit.service";

// Real LLM calls can take 1-3 minutes; Vercel reads this as the function timeout.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const allowed = await rateLimitCheck("agent-chat", user.id, 20, 60 * 60 * 1000);
    if (!allowed) throw new AppError("RATE_LIMITED", "Agent 请求过于频繁，请稍后再试", 429);
    const body = parseWithSchema(agentChatSchema, await readJson(request));
    const run = await runAgent(user.id, body);
    if (run.status === "failed") {
      throw new AppError("AGENT_RUN_FAILED", `Agent 运行失败：${run.failureReason || "模型输出无效"}`, 502, { runId: run.id });
    }
    return ok(run, 201);
  } catch (error) {
    return fail(error);
  }
}
