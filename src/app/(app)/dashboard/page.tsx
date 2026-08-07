"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarPlus,
  Flag,
  Gauge,
  Inbox,
  ListTodo,
  ShieldCheck,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { apiFetch, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WeeklyLoadChart = dynamic(
  () =>
    import("@/components/dashboard-weekly-chart").then(
      (module) => module.WeeklyLoadChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64" />,
  },
);

interface TodayOverview {
  date: string;
  total: number;
  done: number;
  completionRate: number;
  estimateTotal: number;
  highPriority: number;
  maxDailyTasks: number;
}

interface WeeklyLoad {
  days: Array<{
    date: string;
    taskCount: number;
    estimateTotal: number;
    overloaded: boolean;
    timeOverloaded: boolean;
  }>;
  overloadedCount: number;
  maxDailyTasks: number;
}

interface GoalProgress {
  id: string;
  title: string;
  targetDate: string | null;
  taskTotal: number;
  taskDone: number;
  completionRate: number;
}

interface AgentSummary {
  pendingCount: number;
  latestRun: {
    id: string;
    status: string;
    requestText: string;
    promptVersion: string;
  } | null;
  recentActions: Array<{ id: string; tool: string; status: string; explanation: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [requestText, setRequestText] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState("");

  const today = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: () => apiFetch<TodayOverview>("/api/dashboard/today"),
  });
  const weekly = useQuery({
    queryKey: ["dashboard", "weekly"],
    queryFn: () => apiFetch<WeeklyLoad>("/api/dashboard/weekly-load"),
  });
  const goals = useQuery({
    queryKey: ["dashboard", "goals"],
    queryFn: () => apiFetch<GoalProgress[]>("/api/dashboard/goal-progress"),
  });
  const agent = useQuery({
    queryKey: ["dashboard", "agent"],
    queryFn: () => apiFetch<AgentSummary>("/api/dashboard/agent-summary"),
  });

  async function submitAgent(trigger: "dashboard_plan_today" | "agent_input") {
    const text =
      trigger === "dashboard_plan_today" ? "帮我安排今天" : requestText;
    if (!text.trim()) {
      toast.error("请输入 Agent 请求");
      return;
    }
    if (agentRunning) return;
    setAgentRunning(true);
    setAgentError("");
    try {
      await postJson("/api/agent/chat", { requestText: text, trigger });
      toast.success("Agent 建议已生成");
      await queryClient.invalidateQueries();
      router.push("/agent/inbox");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent 请求失败";
      setAgentError(message);
      toast.error(message);
    } finally {
      setAgentRunning(false);
    }
  }

  const completionRate = Math.round((today.data?.completionRate ?? 0) * 100);
  const chartData =
    weekly.data?.days.map((day) => ({
      name: day.date.slice(5),
      taskCount: day.taskCount,
      estimateTotal: day.estimateTotal,
    })) ?? [];

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">工作台</p>
          <h1 className="page-title">仪表盘</h1>
          <p className="page-subtitle">今日、本周、目标与 Agent 建议的实时状态</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => submitAgent("dashboard_plan_today")} disabled={agentRunning}>
            {agentRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {agentRunning ? "生成中" : "帮我安排今天"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/tasks/daily">
              <CalendarPlus className="h-4 w-4" />
              新建任务
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/goals">
              <Flag className="h-4 w-4" />
              新建目标
            </Link>
          </Button>
        </div>
      </header>

      <section className="hero-band fade-up">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-white/90">Agent 请求</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">用一句话安排今天</h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              创建、修改、移动、拆分任务，或拆解目标。建议生成后会在收件箱中等待确认。
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:max-w-lg">
            <div className="flex w-full gap-2">
              <Input
                value={requestText}
                onChange={(event) => setRequestText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitAgent("agent_input");
                  }
                }}
                disabled={agentRunning}
                placeholder="例如：明天上午整理简历项目经历"
                className="h-11 border-white/50 bg-white/95 text-slate-900 shadow-lg backdrop-blur placeholder:text-slate-400"
              />
              <Button
                onClick={() => submitAgent("agent_input")}
                disabled={agentRunning || !requestText.trim()}
                className="h-11 bg-white px-5 text-blue-700 shadow-lg hover:bg-blue-50"
              >
                {agentRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {agentRunning ? "生成中" : "提交"}
              </Button>
            </div>
            <div className="min-h-6">
              {agentRunning ? (
                <p className="flex items-center gap-2 text-sm text-white/90">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在整理上下文并调用模型，生成约需 1-3 分钟
                </p>
              ) : agentError ? (
                <p className="flex items-center gap-2 rounded-md bg-white/15 px-2.5 py-1.5 text-sm text-white">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {agentError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">今日概览</span>
            <span className="icon-chip icon-chip-blue">
              <ListTodo className="h-4 w-4" />
            </span>
          </div>
          {today.isLoading ? (
            <Skeleton className="h-20" />
          ) : today.data ? (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="metric-value">{today.data.done}/{today.data.total}</span>
                <Badge
                  className={cn(
                    completionRate >= 60 ? "soft-badge-teal" : "soft-badge-amber",
                    "border-0",
                  )}
                >
                  {completionRate}%
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">{today.data.date} 已完成任务</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-400">预计时长</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{today.data.estimateTotal} 分钟</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[11px] text-slate-400">高优先级</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{today.data.highPriority} 项</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">本周负载</span>
            <span className="icon-chip icon-chip-teal">
              <Gauge className="h-4 w-4" />
            </span>
          </div>
          {weekly.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="metric-value">
                  {weekly.data?.days.reduce((sum, day) => sum + day.taskCount, 0) ?? 0}
                </span>
                <span className="text-xs text-slate-400">项任务</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">未来 7 天任务分布</p>
              <div className="mt-4 space-y-1.5">
                {weekly.data?.days.slice(0, 7).map((day) => {
                  const max = Math.max(weekly.data.maxDailyTasks, 1);
                  return (
                    <div key={day.date} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[11px] text-slate-400">{day.date.slice(5)}</span>
                      <div className="progress-track h-1.5">
                        <div
                          className={cn(
                            "progress-fill",
                            day.overloaded && "from-amber-400 to-rose-400",
                          )}
                          style={{ width: `${Math.min(100, (day.taskCount / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">目标推进</span>
            <span className="icon-chip icon-chip-amber">
              <Target className="h-4 w-4" />
            </span>
          </div>
          {goals.isLoading ? (
            <Skeleton className="h-20" />
          ) : goals.data?.length ? (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="metric-value">{goals.data.length}</span>
                <span className="text-xs text-slate-400">个进行中目标</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">任务完成率加权平均</p>
              <div className="mt-4 space-y-2.5">
                {goals.data.slice(0, 3).map((goal) => (
                  <div key={goal.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-slate-600">{goal.title}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {Math.round(goal.completionRate * 100)}%
                      </span>
                    </div>
                    <div className="progress-track h-1.5">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.round(goal.completionRate * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="metric-value">0</span>
                <span className="text-xs text-slate-400">暂无进行中目标</span>
              </div>
              <Button variant="outline" className="mt-4 w-full" asChild>
                <Link href="/goals">
                  <Flag className="h-4 w-4" />
                  创建目标
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">Agent 建议</span>
            <span className="icon-chip icon-chip-rose">
              <Inbox className="h-4 w-4" />
            </span>
          </div>
          {agent.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <>
              <div className="flex items-end justify-between gap-2">
                <span className="metric-value">{agent.data?.pendingCount ?? 0}</span>
                <span className="text-xs text-slate-400">条待确认</span>
              </div>
              <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-5 text-slate-500">
                {agent.data?.latestRun?.requestText || "暂无 Agent 运行记录"}
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href="/agent/inbox">
                    查看建议
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" asChild>
                  <Link href="/agent/console">运行记录</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="panel-card fade-up">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">未来 7 天任务分布</h2>
              <p className="mt-0.5 text-xs text-slate-400">按日查看任务量与负载状态</p>
            </div>
            {weekly.data?.overloadedCount ? (
              <Badge className="soft-badge-amber border-0">{weekly.data.overloadedCount} 天过载</Badge>
            ) : (
              <Badge className="soft-badge-teal border-0">
                <TrendingUp className="h-3 w-3" />
                负载正常
              </Badge>
            )}
          </div>
          <div className="panel-card-body">
            {weekly.isLoading ? (
              <Skeleton className="h-64" />
            ) : weekly.data ? (
              <div className="h-64">
                <WeeklyLoadChart data={chartData} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel-card fade-up">
          <div className="panel-card-header">
            <div>
              <h2 className="panel-card-title">目标推进明细</h2>
              <p className="mt-0.5 text-xs text-slate-400">active 目标与关联任务</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/goals">
                全部目标
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="panel-card-body">
            {goals.isLoading ? (
              <Skeleton className="h-56" />
            ) : goals.data?.length ? (
              <div className="space-y-3">
                {goals.data.map((goal) => (
                  <div key={goal.id} className="task-row flex items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="icon-chip icon-chip-blue">
                        <Target className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{goal.title}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {goal.targetDate ? `目标日期 ${goal.targetDate}` : "无目标日期"}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-800">
                        {goal.taskDone}/{goal.taskTotal}
                      </p>
                      <p className="text-[11px] text-slate-400">{Math.round(goal.completionRate * 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <Flag className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-slate-600">还没有 active 目标</p>
                <Button size="sm" asChild>
                  <Link href="/goals">
                    新建目标
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel-card fade-up">
        <div className="panel-card-header">
          <div>
            <h2 className="panel-card-title">最近 Agent 动作</h2>
            <p className="mt-0.5 text-xs text-slate-400">最近运行生成的动作记录</p>
          </div>
          <Badge className="soft-badge-blue border-0">
            <ShieldCheck className="h-3 w-3" />
            可审计
          </Badge>
        </div>
        <div className="panel-card-body">
          {agent.isLoading ? (
            <Skeleton className="h-24" />
          ) : agent.data?.recentActions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agent.data.recentActions.slice(0, 6).map((action) => (
                <div key={action.id} className="task-row p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700">{action.tool}</span>
                    <Badge
                      className={cn(
                        "border-0",
                        action.status === "executed" && "soft-badge-teal",
                        action.status === "failed" && "soft-badge-rose",
                        !["executed", "failed"].includes(action.status) && "soft-badge-amber",
                      )}
                    >
                      {action.status}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{action.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-600">暂无 Agent 动作记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
