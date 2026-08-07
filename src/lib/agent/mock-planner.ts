import type { AgentContext, AgentOutput, AgentTool, ProposedAction } from "@/lib/agent/types";
import { addDays, parseDateKey } from "@/lib/utils";

function stripPhrases(text: string): string {
  return text
    .replace(/帮我|请|麻烦|添加|创建|新增|安排|计划|规划/g, " ")
    .replace(/今天|明天|后天|大后天|昨天|上午|下午|晚上|早上|中午/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRelativeDate(context: AgentContext, text: string): string | null {
  const today = context.currentDate;
  if (/大后天/.test(text)) return addDays(today, 3);
  if (/后天/.test(text)) return addDays(today, 2);
  if (/明天/.test(text)) return addDays(today, 1);
  if (/今天/.test(text)) return today;
  if (/昨天/.test(text)) return addDays(today, -1);

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDay) {
    const month = monthDay[1].padStart(2, "0");
    const day = monthDay[2].padStart(2, "0");
    let year = today.slice(0, 4);
    const candidate = `${year}-${month}-${day}`;
    if (candidate < today) {
      year = String(Number(year) + 1);
      return `${year}-${month}-${day}`;
    }
    return candidate;
  }

  const nextWeek = /下周/.test(text);
  const weekdayMatch = text.match(/(周一|周二|周三|周四|周五|周六|周日|星期[一二三四五六日天])/);
  if (weekdayMatch) {
    const names: Record<string, number> = {
      周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 0,
      星期一: 1, 星期二: 2, 星期三: 3, 星期四: 4, 星期五: 5, 星期六: 6, 星期日: 0, 星期天: 0,
    };
    const target = names[weekdayMatch[0]] ?? 1;
    const current = parseDateKey(today).getUTCDay();
    let diff = (target - current + 7) % 7;
    if (nextWeek) {
      if (diff === 0) diff = 7;
    } else if (current !== target) {
      diff -= 7;
    }
    return addDays(today, diff);
  }

  if (/这个周末|本周末/.test(text)) {
    const current = parseDateKey(today).getUTCDay();
    return addDays(today, (6 - current + 7) % 7);
  }

  return null;
}

function getPriority(text: string): "low" | "medium" | "high" {
  if (/高优先级|重要|紧急/.test(text)) return "high";
  if (/低优先级|不重要/.test(text)) return "low";
  return "medium";
}

function getTimeDetails(text: string): { startTime?: string; estimateMinutes?: number } {
  if (/上午|早上/.test(text)) return { startTime: "09:00", estimateMinutes: 60 };
  if (/下午/.test(text)) return { startTime: "14:00", estimateMinutes: 60 };
  if (/晚上/.test(text)) return { startTime: "20:00", estimateMinutes: 45 };
  return {};
}

function findTask(context: AgentContext, query: string, relatedTaskId?: string) {
  const all = [...context.todayTasks, ...context.next7DaysTasks, ...context.overdueUndoneTasks];
  if (relatedTaskId) {
    const related = all.find((t) => t.id === relatedTaskId) ?? context.relatedTask;
    if (related) return related;
  }
  const tokens = query
    .replace(/移动|移到|改到|挪到|修改|更新|拆分|拆成|任务/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  if (tokens.length === 0) return all[0] ?? null;
  return all.find((task) => tokens.some((token) => String(task.title).includes(token))) ?? all[0] ?? null;
}

function action(
  tool: AgentTool,
  args: Record<string, unknown>,
  explanation: string,
  confidence = 0.85,
  risk_level: ProposedAction["risk_level"] = "low",
): ProposedAction {
  return { tool, args, explanation, confidence, risk_level };
}

function planToday(context: AgentContext): AgentOutput {
  const today = context.currentDate;
  const existing = context.todayTasks.length;
  const remaining = Math.max(0, context.userPreferences.maxDailyTasks - existing);
  if (remaining === 0) {
    return {
      summary: "今日任务数已达到 maxDailyTasks，不建议再新增任务。",
      clarification_questions: [],
      proposed_actions: [],
      risks: ["今日已满，新增任务可能造成过载。"],
      overall_confidence: 0.9,
    };
  }

  const goals = context.activeGoals.length ? context.activeGoals : [];
  const actions: ProposedAction[] = goals.slice(0, Math.min(remaining, 3)).map((goal, index) =>
    action(
      "create_task",
      {
        title: `推进 ${String(goal.title)}：完成今日最小步骤`,
        dateKey: today,
        priority: index === 0 ? "high" : "medium",
        estimateMinutes: 45,
        goalId: goal.id,
      },
      `这是推进目标「${String(goal.title)}」的最小可执行步骤。`,
      0.8,
      "low",
    ),
  );

  if (actions.length === 0) {
    actions.push(
      action(
        "create_task",
        {
          title: "列出今日最重要的三项待办",
          dateKey: today,
          priority: "high",
          estimateMinutes: 30,
        },
        "帮助用户从空白日开始建立今日计划。",
        0.72,
        "low",
      ),
    );
  }

  return {
    summary: `今天已有 ${existing} 个任务，建议再安排 ${actions.length} 个可执行任务。`,
    clarification_questions: [],
    proposed_actions: actions,
    risks: [],
    overall_confidence: 0.82,
  };
}

function createTask(context: AgentContext, requestText: string): AgentOutput {
  const date = parseRelativeDate(context, requestText);
  const title = stripPhrases(requestText);
  if (!date) {
    return {
      summary: "我需要确认任务日期。",
      clarification_questions: ["你想把任务安排到哪一天？"],
      proposed_actions: [],
      risks: [],
      overall_confidence: 0.4,
    };
  }
  if (!title) {
    return {
      summary: "任务标题还不明确。",
      clarification_questions: ["请告诉我任务的具体内容。"],
      proposed_actions: [],
      risks: [],
      overall_confidence: 0.4,
    };
  }
  const time = getTimeDetails(requestText);
  const goalId = context.activeGoals[0]?.id as string | undefined;
  const args: Record<string, unknown> = {
    title,
    dateKey: date,
    priority: getPriority(requestText),
    ...time,
  };
  if (goalId) args.goalId = goalId;
  return {
    summary: `已生成 ${date} 的任务建议：${title}`,
    clarification_questions: [],
    proposed_actions: [action("create_task", args, "根据用户自然语言提取的任务创建建议。", 0.9)],
    risks: [],
    overall_confidence: 0.88,
  };
}

function moveTask(context: AgentContext, requestText: string): AgentOutput {
  const task = findTask(context, requestText, context.relatedTask?.id as string | undefined);
  const date = parseRelativeDate(context, requestText);
  if (!task) {
    return {
      summary: "没有找到你要移动的任务。",
      clarification_questions: ["请告诉我需要移动哪个任务？"],
      proposed_actions: [],
      risks: [],
      overall_confidence: 0.35,
    };
  }
  if (!date) {
    return {
      summary: "移动目标日期还不明确。",
      clarification_questions: ["你希望把它移动到哪一天？"],
      proposed_actions: [],
      risks: [],
      overall_confidence: 0.35,
    };
  }
  return {
    summary: `建议将「${String(task.title)}」从 ${String(task.dateKey)} 移动到 ${date}。`,
    clarification_questions: [],
    proposed_actions: [
      action(
        "move_task",
        { taskId: task.id, newDateKey: date },
        "该任务未完成，移动到新日期可以避免堆积。",
        0.9,
        "medium",
      ),
    ],
    risks: ["移动任务会改变原日期安排，需要用户确认。"],
    overall_confidence: 0.88,
  };
}

function splitTask(context: AgentContext, requestText: string): AgentOutput {
  const source = findTask(context, requestText, context.relatedTask?.id as string | undefined);
  if (!source) {
    return {
      summary: "没有找到要拆分的任务。",
      clarification_questions: ["你想拆分哪个任务？"],
      proposed_actions: [],
      risks: [],
      overall_confidence: 0.35,
    };
  }
  const baseDate = String(source.dateKey);
  const subtasks = [
    { title: `${String(source.title)}：明确范围`, dateKey: baseDate, priority: "high", estimateMinutes: 30 },
    { title: `${String(source.title)}：拆解执行清单`, dateKey: addDays(baseDate, 1), priority: "high", estimateMinutes: 45 },
    { title: `${String(source.title)}：完成第一项交付`, dateKey: addDays(baseDate, 1), priority: "medium", estimateMinutes: 45 },
  ];
  return {
    summary: `建议将「${String(source.title)}」拆分为 3 个可执行子任务。`,
    clarification_questions: [],
    proposed_actions: [
      action(
        "split_task",
        { sourceTaskId: source.id, subtasks },
        "原任务过大，拆分后更容易开始。",
        0.84,
        "medium",
      ),
    ],
    risks: ["拆分后原任务仍会保留，用户可手动决定是否删除。"],
    overall_confidence: 0.84,
  };
}

function decomposeGoal(context: AgentContext, requestText: string): AgentOutput {
  const goal = context.relatedGoal ?? context.activeGoals[0] ?? null;
  if (!goal) {
    return {
      summary: "当前没有可拆解的 active 目标。",
      clarification_questions: [],
      proposed_actions: [],
      risks: ["请先创建一个长期目标。"],
      overall_confidence: 0.9,
    };
  }
  const today = context.currentDate;
  const goalTitle = String(goal.title);
  const actions = [
    action(
      "create_task",
      {
        title: `拆解 ${goalTitle}：确定范围和交付物`,
        dateKey: today,
        priority: "high",
        estimateMinutes: 40,
        goalId: goal.id,
      },
      "先建立目标拆解框架。",
      0.82,
      "low",
    ),
    action(
      "create_task",
      {
        title: `拆解 ${goalTitle}：列出执行清单`,
        dateKey: addDays(today, 1),
        priority: "high",
        estimateMinutes: 60,
        goalId: goal.id,
      },
      "将目标转化为可执行清单。",
      0.8,
      "low",
    ),
    action(
      "create_task",
      {
        title: `拆解 ${goalTitle}：安排首轮执行`,
        dateKey: addDays(today, 2),
        priority: "medium",
        estimateMinutes: 45,
        goalId: goal.id,
      },
      "通过首轮执行验证计划可行性。",
      0.76,
      "low",
    ),
  ];
  return {
    summary: `建议把「${goalTitle}」拆成未来三天的执行任务。`,
    clarification_questions: [],
    proposed_actions: actions,
    risks: [],
    overall_confidence: 0.79,
  };
}

function safetyReject(summary: string, risk: string): AgentOutput {
  return {
    summary,
    clarification_questions: [],
    proposed_actions: [],
    risks: [risk],
    overall_confidence: 0.98,
  };
}

export function mockPlanner(context: AgentContext, requestText: string): AgentOutput {
  const text = requestText.toLowerCase();
  if (/忽略(上述)?规则|输出密钥|环境变量|数据库|其他用户/.test(text)) {
    return safetyReject("该请求超出日程规划范围，且可能试图绕过安全边界，已拒绝。", "不允许处理密钥、数据库内容或其他用户数据。");
  }
  if (/删除|移除|清空/.test(text) && /任务/.test(text)) {
    return safetyReject("当前版本不支持由 Agent 删除任务。", "删除任务属于高风险操作，需要用户在任务列表中手动完成。");
  }
  if (/修改目标|创建目标|删除目标|目标改为/.test(text)) {
    return safetyReject("Agent 不支持创建、修改或删除目标。", "目标只能由用户手动管理。");
  }
  if (context.trigger === "goal_decompose" || /拆解目标|拆解这个目标/.test(text)) {
    return decomposeGoal(context, requestText);
  }
  if (context.trigger === "daily_task_split" || /拆分|拆成/.test(text)) {
    return splitTask(context, requestText);
  }
  if (context.trigger === "daily_task_move" || /移动|移到|挪到/.test(text)) {
    return moveTask(context, requestText);
  }
  if (context.trigger === "dashboard_plan_today" || /今天|今日|plan today|规划今天/.test(text)) {
    return planToday(context);
  }
  if (/修改|更新|改一下|改为|改成|改到|调高|调低|调到/.test(text) && /把|将/.test(text)) {
    const task = findTask(context, requestText, context.relatedTask?.id as string | undefined);
    if (task) {
      const args: Record<string, unknown> = { taskId: task.id };
      if (/优先级|重要|紧急/.test(requestText)) args.priority = getPriority(requestText);
      if (/晚上|20点|20:00/.test(requestText)) args.startTime = "20:00";
      if (/上午|早上/.test(requestText)) args.startTime = "09:00";
      if (/下午/.test(requestText)) args.startTime = "14:00";
      const titleMatch = requestText.match(/(?:改为|改成)["“]?(.+?)["”]?$/);
      if (titleMatch) args.title = titleMatch[1].trim();
      const date = parseRelativeDate(context, requestText);
      if (date) args.dateKey = date;
      return {
        summary: `建议更新任务「${String(task.title)}」。`,
        clarification_questions: [],
        proposed_actions: [action("update_task", args, "根据用户请求更新任务字段。", 0.85, "medium")],
        risks: ["更新任务会改变原安排，需要用户确认。"],
        overall_confidence: 0.84,
      };
    }
  }
  if (/创建|添加|新增|安排/.test(text) || context.trigger === "agent_input") {
    return createTask(context, requestText);
  }
  return {
    summary: "我需要更多信息才能生成建议。",
    clarification_questions: ["你想规划、创建、移动还是拆分任务？", "希望安排在哪一天？"],
    proposed_actions: [],
    risks: [],
    overall_confidence: 0.3,
  };
}
