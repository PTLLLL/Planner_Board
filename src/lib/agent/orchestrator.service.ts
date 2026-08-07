import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { buildAgentContext } from "@/lib/agent/context.service";
import { PROMPT_VERSION, renderPrompt } from "@/lib/agent/prompt-renderer";
import { generateAgentCompletion, getLlmConfig } from "@/lib/agent/llm-client";
import { validateAgentOutput, type ValidationResult } from "@/lib/agent/output-validator";
import type { AgentContext, AgentTrigger } from "@/lib/agent/types";
import { emitServerEvent } from "@/lib/services/metrics.service";

function serializeRun(run: any) {
  return {
    id: run.id,
    status: run.status,
    requestText: run.requestText,
    contextSnapshot: run.contextSnapshot,
    modelName: run.modelName,
    promptVersion: run.promptVersion,
    outputRaw: run.outputRaw,
    outputParsed: run.outputParsed,
    failureReason: run.failureReason,
    latencyMs: run.latencyMs,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    actions: run.actions
      ? run.actions.map((action: any) => ({
          id: action.id,
          tool: action.tool,
          originalArgs: action.originalArgs,
          editedArgs: action.editedArgs,
          explanation: action.explanation,
          confidence: action.confidence,
          riskLevel: action.riskLevel,
          status: action.status,
          failureReason: action.failureReason,
          expiresAt: action.expiresAt.toISOString(),
        }))
      : [],
  };
}

export async function runAgent(userId: string, input: AgentTrigger) {
  const context = await buildAgentContext(userId, input);
  return runAgentWithContext(userId, input, context);
}

export async function runAgentWithContext(
  userId: string,
  input: AgentTrigger,
  context: AgentContext,
) {
  const running = await prisma.agentRun.findFirst({
    where: { userId, status: { in: ["pending", "running"] } },
  });
  if (running) {
    throw new AppError("AGENT_RUNNING", "已有运行中的 Agent 请求，请等待完成", 409);
  }

  const config = getLlmConfig();
  const run = await prisma.agentRun.create({
    data: {
      userId,
      requestText: input.requestText,
      contextSnapshot: context as unknown as object,
      modelName: config.modelName,
      promptVersion: PROMPT_VERSION,
      status: "pending",
    },
  });
  await emitServerEvent(userId, "agent_requested", {
    run_id: run.id,
    trigger: input.trigger,
    has_related_goal: Boolean(input.relatedGoalId),
    has_related_task: Boolean(input.relatedTaskId),
  });

  const startedAt = new Date();
  await prisma.agentRun.update({ where: { id: run.id }, data: { status: "running", startedAt } });
  const prompt = renderPrompt(context, input.requestText);

  let validation: ValidationResult = { ok: false };
  let content = "";
  let failureReason: string | null = null;
  let outputParsed: unknown = null;

  const configuredRetries = Number(process.env.LLM_MAX_RETRY || 2);
  const maxAttempts = Number.isFinite(configuredRetries)
    ? Math.min(Math.max(Math.floor(configuredRetries), 1), 3)
    : 2;
  const configuredBackoff = Number(process.env.LLM_RETRY_BACKOFF_MS || 30000);
  const backoffMs =
    Number.isFinite(configuredBackoff) && configuredBackoff > 0
      ? Math.min(Math.round(configuredBackoff), 60000)
      : 30000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await generateAgentCompletion({
        prompt,
        context,
        requestText: input.requestText,
        retry: attempt > 0,
      });
      content = response.content;
      validation = validateAgentOutput(content, context);
      if (validation.ok) {
        outputParsed = validation.output;
        break;
      }
      failureReason = validation.failureReason ?? "AGENT_OUTPUT_INVALID";
    } catch (error) {
      failureReason = error instanceof AppError ? error.message : "模型输出无效";
      if (attempt >= maxAttempts - 1) break;
      const delay = Math.min(backoffMs * 2 ** attempt, 60000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const finishedAt = new Date();
  const latencyMs = Math.round(finishedAt.getTime() - startedAt.getTime());

  if (!validation.ok || !outputParsed) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        outputRaw: content || null,
        failureReason,
        finishedAt,
        latencyMs,
      },
    });
    await emitServerEvent(userId, "agent_run_failed", {
      run_id: run.id,
      failure_reason: failureReason,
      latency_ms: latencyMs,
      prompt_version: PROMPT_VERSION,
      model_name: config.modelName,
    });
    const failedRun = await prisma.agentRun.findUnique({ where: { id: run.id } });
    return serializeRun(failedRun);
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const output = outputParsed as {
    summary: string;
    clarification_questions: string[];
    proposed_actions: Array<{
      tool: string;
      args: Record<string, unknown>;
      explanation: string;
      confidence: number;
      risk_level: string;
    }>;
    risks: string[];
    overall_confidence: number;
  };

  const actions = await Promise.all(
    output.proposed_actions.map((action) =>
      prisma.agentAction.create({
        data: {
          agentRunId: run.id,
          userId,
          tool: action.tool as never,
          originalArgs: action.args as Prisma.InputJsonValue,
          explanation: action.explanation,
          confidence: action.confidence,
          riskLevel: action.risk_level,
          expiresAt,
        },
      }),
    ),
  );

  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      outputRaw: content,
      outputParsed: output as unknown as Prisma.InputJsonValue,
      finishedAt,
      latencyMs,
    },
  });

  await emitServerEvent(userId, "agent_run_completed", {
    run_id: run.id,
    latency_ms: latencyMs,
    proposed_action_count: actions.length,
    clarification_count: output.clarification_questions.length,
    prompt_version: PROMPT_VERSION,
    model_name: config.modelName,
  });

  const completedRun = await prisma.agentRun.findUnique({
    where: { id: run.id },
    include: { actions: true },
  });
  return serializeRun(completedRun);
}

export async function listAgentRuns(
  userId: string,
  options: { status?: string; page?: number; pageSize?: number } = {},
) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const where = {
    userId,
    ...(options.status ? { status: options.status as never } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.agentRun.count({ where }),
    prisma.agentRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { actions: true } }, actions: { take: 5 } },
    }),
  ]);
  return {
    items: items.map(serializeRun),
    page,
    pageSize,
    total,
  };
}

export async function getAgentRunDetail(userId: string, id: string) {
  const run = await prisma.agentRun.findFirst({
    where: { id, userId },
    include: {
      actions: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) throw new AppError("RESOURCE_NOT_FOUND", "运行记录不存在", 404);
  return serializeRun(run);
}
