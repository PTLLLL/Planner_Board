import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { runAgentWithContext } from "@/lib/agent/orchestrator.service";
import type { AgentContext, AgentTrigger } from "@/lib/agent/types";
import { emitServerEvent } from "@/lib/services/metrics.service";

const contextDefaults: AgentContext = {
  currentDate: "2026-08-05",
  timezone: "Asia/Shanghai",
  trigger: "agent_input",
  userPreferences: {
    maxDailyTasks: 5,
    workStartTime: "09:00",
    workEndTime: "22:00",
    preferredFocusTime: "morning",
  },
  activeGoals: [],
  todayTasks: [],
  next7DaysTasks: [],
  overdueUndoneTasks: [],
  recentCompletionRate: 0,
  overloadedDays: [],
  pendingActionsCount: 0,
  relatedGoal: null,
  relatedTask: null,
};

function normalizeContext(snapshot: Record<string, unknown>): AgentContext {
  const prefs = (snapshot.userPreferences ?? {}) as Record<string, unknown>;
  return {
    ...contextDefaults,
    ...snapshot,
    userPreferences: { ...contextDefaults.userPreferences, ...prefs },
    activeGoals: (snapshot.activeGoals as Array<Record<string, unknown>>) ?? [],
    todayTasks: (snapshot.todayTasks as Array<Record<string, unknown>>) ?? [],
    next7DaysTasks: (snapshot.next7DaysTasks as Array<Record<string, unknown>>) ?? [],
    overdueUndoneTasks: (snapshot.overdueUndoneTasks as Array<Record<string, unknown>>) ?? [],
    relatedGoal: (snapshot.relatedGoal as Record<string, unknown> | null) ?? null,
    relatedTask: (snapshot.relatedTask as Record<string, unknown> | null) ?? null,
  };
}

function triggerForCategory(category: string): AgentTrigger["trigger"] {
  if (category === "plan_today") return "dashboard_plan_today";
  if (category === "decompose_goal") return "goal_decompose";
  if (category === "move_task") return "daily_task_move";
  if (category === "split_task") return "daily_task_split";
  return "agent_input";
}

function extractDates(output: any): string[] {
  const dates: string[] = [];
  for (const action of output?.proposed_actions ?? []) {
    if (action.args?.dateKey) dates.push(String(action.args.dateKey));
    if (action.args?.newDateKey) dates.push(String(action.args.newDateKey));
    for (const subtask of action.args?.subtasks ?? []) {
      if (subtask.dateKey) dates.push(String(subtask.dateKey));
    }
  }
  return dates;
}

export async function runEval(
  userId: string,
  options: { caseIds?: string[]; categories?: string[] } = {},
) {
  const where: Record<string, unknown> = {};
  if (options.caseIds?.length) where.id = { in: options.caseIds };
  if (options.categories?.length) where.category = { in: options.categories };
  const cases = await prisma.evalCase.findMany({ where, orderBy: { category: "asc" } });
  if (cases.length === 0) {
    throw new AppError("RESOURCE_NOT_FOUND", "没有可运行的测试用例", 404);
  }

  await emitServerEvent(userId, "eval_run_started", {
    eval_run_id: crypto.randomUUID(),
    case_count: cases.length,
    category_filter: options.categories ?? [],
  });

  const results = [];
  for (const testCase of cases) {
    const context = normalizeContext(testCase.contextSnapshot as Record<string, unknown>);
    const input: AgentTrigger = {
      requestText: testCase.userQuery,
      trigger: triggerForCategory(testCase.category),
      relatedGoalId: (testCase.contextSnapshot as any)?.relatedGoalId,
      relatedTaskId: (testCase.contextSnapshot as any)?.relatedTaskId,
    };
    context.trigger = input.trigger;
    const run = await runAgentWithContext(userId, input, context);
    const expectedTools = testCase.expectedTools;
    const actualTools = run.actions.map((action: any) => String(action.tool));
    const constraints = (testCase.expectedConstraints ?? {}) as Record<string, unknown>;
    const expectedDates = (constraints.dates as string[] | undefined) ?? [];
    const actualDates = extractDates(run.outputParsed);
    const toolAccuracy =
      expectedTools.length === 0
        ? actualTools.length === 0
          ? 1
          : 0
        : expectedTools.every((tool) => actualTools.includes(tool))
          ? 1
          : 0.5;
    const dateAccuracy =
      expectedDates.length === 0
        ? 1
        : expectedDates.every((date) => actualDates.includes(date))
          ? 1
          : 0.5;
    const requiresClarification = testCase.category === "clarification";
    const requiresAction = expectedTools.length > 0;
    const hasClarification = (run.outputParsed?.clarification_questions?.length ?? 0) > 0;
    const hasAction = actualTools.length > 0;
    const constraintsSatisfied =
      (requiresClarification ? hasClarification && !hasAction : true) &&
      (requiresAction ? hasAction : true) &&
      (constraints.noDelete ? !actualTools.includes("delete_task") : true) &&
      (constraints.noGoalWrites
        ? !["create_goal", "update_goal", "delete_goal"].some((tool) => actualTools.includes(tool))
        : true);
    const passed = run.status === "completed" && toolAccuracy === 1 && dateAccuracy === 1 && constraintsSatisfied;
    const planQuality = passed ? 4.5 : run.status === "completed" ? 2 : 1;
    const failureCategory = passed ? null : run.failureReason ?? (toolAccuracy < 1 ? "BAD-02" : dateAccuracy < 1 ? "BAD-03" : "BAD-07");

    const result = await prisma.evalResult.create({
      data: {
        evalCaseId: testCase.id,
        agentRunId: run.id,
        passed,
        score: planQuality,
        toolCallAccuracy: toolAccuracy,
        dateParsingAccuracy: dateAccuracy,
        planQualityScore: planQuality,
        failureCategory,
        notes: passed ? null : `实际工具：${actualTools.join(",")}；期望工具：${expectedTools.join(",")}`,
      },
    });
    results.push({
      id: result.id,
      caseId: testCase.id,
      caseName: testCase.name,
      category: testCase.category,
      passed,
      score: planQuality,
      toolCallAccuracy: toolAccuracy,
      dateParsingAccuracy: dateAccuracy,
      failureCategory,
      notes: result.notes,
      createdAt: result.createdAt.toISOString(),
    });
  }

  await emitServerEvent(userId, "eval_run_completed", {
    eval_run_id: crypto.randomUUID(),
    passed_count: results.filter((r) => r.passed).length,
    failed_count: results.filter((r) => !r.passed).length,
    duration_ms: 0,
    prompt_version: "planner-agent-v1.0.0",
    model_name: process.env.LLM_MODEL_NAME || "planner-agent-mock",
  });
  return results;
}

export async function listEvalCases(options: { category?: string; page?: number; pageSize?: number } = {}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const where = options.category ? { category: options.category as never } : {};
  const [total, items] = await Promise.all([
    prisma.evalCase.count({ where }),
    prisma.evalCase.findMany({ where, orderBy: { category: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      userQuery: item.userQuery,
      expectedTools: item.expectedTools,
      expectedConstraints: item.expectedConstraints,
      createdAt: item.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
  };
}

export async function listEvalResults(options: { category?: string; page?: number; pageSize?: number } = {}) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const where = options.category ? { evalCase: { category: options.category as never } } : {};
  const [total, items] = await Promise.all([
    prisma.evalResult.count({ where }),
    prisma.evalResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { evalCase: { select: { name: true, category: true } } },
    }),
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      caseId: item.evalCaseId,
      caseName: item.evalCase.name,
      category: item.evalCase.category,
      passed: item.passed,
      score: item.score,
      toolCallAccuracy: item.toolCallAccuracy,
      dateParsingAccuracy: item.dateParsingAccuracy,
      planQualityScore: item.planQualityScore,
      failureCategory: item.failureCategory,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
  };
}

export async function getEvalSummary() {
  const [totalCases, totalResults, passed, failed, recent] = await Promise.all([
    prisma.evalCase.count(),
    prisma.evalResult.count(),
    prisma.evalResult.count({ where: { passed: true } }),
    prisma.evalResult.count({ where: { passed: false } }),
    prisma.evalResult.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);
  return {
    totalCases,
    totalResults,
    passed,
    failed,
    jsonSuccessRate: totalResults ? Number((passed / totalResults).toFixed(2)) : 0,
    lastRunAt: recent?.createdAt.toISOString() ?? null,
  };
}
