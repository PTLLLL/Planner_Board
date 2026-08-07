"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  TerminalSquare,
  Wrench,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface RunItem {
  id: string;
  status: string;
  requestText: string;
  modelName: string;
  promptVersion: string;
  latencyMs: number | null;
  failureReason: string | null;
  outputParsed: {
    summary?: string;
    clarification_questions?: string[];
    proposed_actions?: Array<{ tool: string; status?: string }>;
  } | null;
  actions: Array<{
    id: string;
    tool: string;
    status: string;
    explanation: string;
    resultEntityId: string | null;
    failureReason: string | null;
  }>;
}

interface ActionItem {
  id: string;
  tool: string;
  status: string;
  riskLevel: string;
  confidence: number;
  explanation: string;
}

export default function AgentConsolePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => apiFetch<{ items: RunItem[] }>("/api/agent/runs?pageSize=50"),
  });
  const actions = useQuery({
    queryKey: ["agent-actions-console"],
    queryFn: () => apiFetch<{ items: ActionItem[] }>("/api/agent/actions?pageSize=100"),
  });
  const selectedRun = runs.data?.items.find((run) => run.id === selectedId) ?? null;

  const metrics = useMemo(() => {
    const items = runs.data?.items ?? [];
    const completed = items.filter((run) => run.status === "completed").length;
    const failed = items.filter((run) => run.status === "failed").length;
    const latencies = items.map((run) => run.latencyMs ?? 0).filter(Boolean);
    const actionItems = actions.data?.items ?? [];
    const accepted = actionItems.filter((action) => action.status === "executed").length;
    return {
      total: items.length,
      completed,
      failed,
      jsonSuccessRate: items.length ? completed / items.length : 0,
      avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      actionTotal: actionItems.length,
      accepted,
      actionAcceptRate: actionItems.length ? accepted / actionItems.length : 0,
    };
  }, [runs.data, actions.data]);

  const statusBadge = (status: string) =>
    cn(
      "border-0",
      status === "failed" && "soft-badge-rose",
      status === "completed" && "soft-badge-teal",
      status === "executed" && "soft-badge-teal",
      !["failed", "completed", "executed"].includes(status) && "soft-badge-amber",
    );

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agent</p>
          <h1 className="page-title">Agent 控制台</h1>
          <p className="page-subtitle">运行记录、建议状态与指标</p>
        </div>
      </header>

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">运行记录</TabsTrigger>
          <TabsTrigger value="metrics">指标</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <div className="panel-card">
              <div className="panel-card-header">
                <div>
                  <h2 className="panel-card-title">Agent Runs</h2>
                  <p className="mt-0.5 text-xs text-slate-400">最近 50 次运行</p>
                </div>
                <Badge className="soft-badge-blue border-0">
                  <TerminalSquare className="h-3 w-3" />
                  {runs.data?.items.length ?? 0} 条
                </Badge>
              </div>
              <div className="panel-card-body">
                {runs.isLoading ? (
                  <Skeleton className="h-64" />
                ) : runs.data?.items.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>请求摘要</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>模型</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>耗时</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.data.items.map((run) => (
                        <TableRow
                          key={run.id}
                          className={cn("cursor-pointer", selectedId === run.id && "bg-blue-50/60")}
                          onClick={() => setSelectedId(run.id)}
                        >
                          <TableCell className="max-w-56 truncate font-medium text-slate-800">{run.requestText}</TableCell>
                          <TableCell>
                            <Badge className={statusBadge(run.status)}>{run.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{run.modelName}</TableCell>
                          <TableCell className="text-xs text-slate-500">{run.promptVersion}</TableCell>
                          <TableCell className="text-xs text-slate-500">{run.latencyMs ?? "-"} ms</TableCell>
                          <TableCell>
                            <ChevronRight className={cn("h-4 w-4 text-slate-300 transition-colors", selectedId === run.id && "text-blue-600")} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">
                      <TerminalSquare className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-600">暂无运行记录</p>
                  </div>
                )}
              </div>
            </div>

            <div className="panel-card fade-up self-start">
              <div className="panel-card-header">
                <div>
                  <h2 className="panel-card-title">运行详情</h2>
                  <p className="mt-0.5 text-xs text-slate-400">点击左侧记录查看</p>
                </div>
              </div>
              <div className="panel-card-body">
                {selectedRun ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">请求</p>
                      <p className="mt-1.5 text-sm font-medium leading-6 text-slate-800">{selectedRun.requestText}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">状态</p>
                        <Badge className={cn(statusBadge(selectedRun.status), "mt-1.5")}>{selectedRun.status}</Badge>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">耗时</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{selectedRun.latencyMs ?? "-"} ms</p>
                      </div>
                    </div>
                    {selectedRun.failureReason ? (
                      <div className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm leading-6 text-rose-700">
                        {selectedRun.failureReason}
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">输出摘要</p>
                      <p className="mt-1.5 text-sm leading-6 text-slate-600">{selectedRun.outputParsed?.summary ?? "-"}</p>
                    </div>
                    {selectedRun.outputParsed?.clarification_questions?.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">澄清问题</p>
                        <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                          {selectedRun.outputParsed.clarification_questions.map((question) => (
                            <li key={question} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                              {question}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">动作</p>
                      <div className="space-y-2">
                        {selectedRun.actions.length ? (
                          selectedRun.actions.map((action) => (
                            <div key={action.id} className="task-row p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 font-mono text-xs font-semibold text-blue-700">
                                  <Wrench className="h-3.5 w-3.5" />
                                  {action.tool}
                                </span>
                                <Badge className={statusBadge(action.status)}>{action.status}</Badge>
                              </div>
                              <p className="mt-1.5 text-xs leading-5 text-slate-500">{action.explanation}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400">无动作</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon">
                      <ChevronRight className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-slate-600">选择一条运行记录查看详情</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="metric-card">
              <div className="metric-card-topline">
                <span className="metric-label">运行总数</span>
                <span className="icon-chip icon-chip-blue">
                  <Activity className="h-4 w-4" />
                </span>
              </div>
              <span className="metric-value">{metrics.total}</span>
              <p className="mt-1 text-xs text-slate-400">累计 Agent 运行</p>
            </div>
            <div className="metric-card">
              <div className="metric-card-topline">
                <span className="metric-label">运行成功率</span>
                <span className="icon-chip icon-chip-teal">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <span className="metric-value">{Math.round(metrics.jsonSuccessRate * 100)}%</span>
              <p className="mt-1 text-xs text-slate-400">completed / total</p>
            </div>
            <div className="metric-card">
              <div className="metric-card-topline">
                <span className="metric-label">平均耗时</span>
                <span className="icon-chip icon-chip-amber">
                  <Clock className="h-4 w-4" />
                </span>
              </div>
              <span className="metric-value">{metrics.avgLatency} <span className="text-base font-semibold text-slate-400">ms</span></span>
              <p className="mt-1 text-xs text-slate-400">所有运行平均延迟</p>
            </div>
            <div className="metric-card">
              <div className="metric-card-topline">
                <span className="metric-label">建议总数</span>
                <span className="icon-chip icon-chip-rose">
                  <Inbox className="h-4 w-4" />
                </span>
              </div>
              <span className="metric-value">{metrics.actionTotal}</span>
              <p className="mt-1 text-xs text-slate-400">生成的动作建议</p>
            </div>
            <div className="metric-card">
              <div className="metric-card-topline">
                <span className="metric-label">建议接受率</span>
                <span className="icon-chip icon-chip-teal">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
              </div>
              <span className="metric-value">{Math.round(metrics.actionAcceptRate * 100)}%</span>
              <p className="mt-1 text-xs text-slate-400">executed / total</p>
            </div>
          </div>
          <div className="panel-card mt-5">
            <div className="panel-card-header">
              <div>
                <h2 className="panel-card-title">运行健康度</h2>
                <p className="mt-0.5 text-xs text-slate-400">失败与异常状态汇总</p>
              </div>
            </div>
            <div className="panel-card-body grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="task-row flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="icon-chip icon-chip-teal">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">完成</p>
                    <p className="text-xs text-slate-400">completed 状态</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-slate-800">{metrics.completed}</span>
              </div>
              <div className="task-row flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="icon-chip icon-chip-rose">
                    <XCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">失败</p>
                    <p className="text-xs text-slate-400">failed 状态</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-slate-800">{metrics.failed}</span>
              </div>
              <div className="task-row flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="icon-chip icon-chip-amber">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">已接受动作</p>
                    <p className="text-xs text-slate-400">executed 状态</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-slate-800">{metrics.accepted}</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
