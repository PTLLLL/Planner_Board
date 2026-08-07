"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot,
  Check,
  Edit3,
  Inbox,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { apiFetch, patchJson, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AgentAction {
  id: string;
  agentRunId: string;
  tool: string;
  originalArgs: Record<string, unknown>;
  editedArgs: Record<string, unknown> | null;
  explanation: string;
  confidence: number;
  riskLevel: string;
  status: string;
  expiresAt: string;
  run?: {
    requestText: string;
    createdAt: string;
  } | null;
}

interface ActionList {
  items: AgentAction[];
  total: number;
}

export default function AgentInboxPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("proposed");
  const [editAction, setEditAction] = useState<AgentAction | null>(null);
  const [editArgs, setEditArgs] = useState("");
  const [selectedSubtasks, setSelectedSubtasks] = useState<Record<string, number[]>>({});

  const actions = useQuery({
    queryKey: ["agent-actions", tab],
    queryFn: () =>
      apiFetch<ActionList>(
        tab === "proposed"
          ? "/api/agent/actions?status=proposed&pageSize=50"
          : "/api/agent/actions?pageSize=50",
      ),
  });

  const groups = useMemo(() => {
    const map = new Map<string, AgentAction[]>();
    for (const action of actions.data?.items ?? []) {
      const list = map.get(action.agentRunId) ?? [];
      list.push(action);
      map.set(action.agentRunId, list);
    }
    return Array.from(map.entries());
  }, [actions.data]);

  const pendingCount = useMemo(
    () => actions.data?.items.filter((action) => action.status === "proposed").length ?? 0,
    [actions.data],
  );
  const highRiskCount = useMemo(
    () => actions.data?.items.filter((action) => action.riskLevel === "high").length ?? 0,
    [actions.data],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
    await queryClient.invalidateQueries({ queryKey: ["nav-pending"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function approve(action: AgentAction) {
    try {
      const subtaskIndices =
        action.tool === "split_task" ? (selectedSubtasks[action.id] ?? []) : undefined;
      if (action.tool === "split_task" && subtaskIndices?.length === 0) {
        toast.error("请至少选择一个子任务");
        return;
      }
      await postJson(`/api/agent/actions/${action.id}/approve`, {
        subtaskIndices,
      });
      toast.success("建议已执行");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "执行失败");
    }
  }

  async function reject(action: AgentAction) {
    try {
      await postJson(`/api/agent/actions/${action.id}/reject`, {
        feedbackType: "rejected",
      });
      toast.success("建议已拒绝");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "拒绝失败");
    }
  }

  function openEdit(action: AgentAction) {
    const args = action.editedArgs ?? action.originalArgs;
    setEditArgs(JSON.stringify(args, null, 2));
    setEditAction(action);
  }

  async function saveEditAndApprove() {
    if (!editAction) return;
    try {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(editArgs);
      } catch {
        toast.error("参数必须是合法 JSON");
        return;
      }
      await patchJson(`/api/agent/actions/${editAction.id}/edit`, { args });
      await postJson(`/api/agent/actions/${editAction.id}/approve`);
      toast.success("已编辑并接受");
      setEditAction(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "编辑失败");
    }
  }

  function toggleSubtask(actionId: string, index: number) {
    const current = selectedSubtasks[actionId] ?? [];
    setSelectedSubtasks({
      ...selectedSubtasks,
      [actionId]: current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    });
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agent</p>
          <h1 className="page-title">Agent 收件箱</h1>
          <p className="page-subtitle">
            {tab === "proposed" ? "待确认建议必须先确认后才会执行" : "已处理建议历史"}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">当前建议</span>
            <span className="icon-chip icon-chip-blue">
              <Inbox className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{actions.data?.items.length ?? 0}</span>
          <p className="mt-1 text-xs text-slate-400">当前视图中的动作数量</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">待确认</span>
            <span className="icon-chip icon-chip-amber">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{pendingCount}</span>
          <p className="mt-1 text-xs text-slate-400">需要你审阅后执行</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">高风险</span>
            <span className="icon-chip icon-chip-rose">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{highRiskCount}</span>
          <p className="mt-1 text-xs text-slate-400">建议执行前请重点检查</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="proposed">待确认</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {actions.isLoading ? (
            <Skeleton className="h-64" />
          ) : groups.length ? (
            <div className="space-y-6">
              {groups.map(([runId, items]) => (
                <section key={runId} className="space-y-3">
                  <div className="panel-card fade-up overflow-hidden">
                    <div className="panel-card-header">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="icon-chip icon-chip-blue">
                          <Bot className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {items[0].run?.requestText || "Agent 运行"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {items[0].run?.createdAt ? new Date(items[0].run.createdAt).toLocaleString() : "运行时间未知"}
                          </p>
                        </div>
                      </div>
                      <Badge className="soft-badge-blue border-0">
                        {items.length} 个动作
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {items.map((action) => (
                      <Card key={action.id} className="fade-up overflow-hidden">
                        <CardHeader className="border-b border-slate-100">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span
                                className={cn(
                                  "icon-chip shrink-0",
                                  action.riskLevel === "high"
                                    ? "icon-chip-rose"
                                    : action.riskLevel === "medium"
                                      ? "icon-chip-amber"
                                      : "icon-chip-teal",
                                )}
                              >
                                <Wrench className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <CardTitle className="font-mono text-[13px]">{action.tool}</CardTitle>
                                <p className="mt-1.5 text-sm leading-5 text-slate-500">{action.explanation}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                              <Badge
                                className={cn(
                                  "border-0",
                                  action.riskLevel === "high" && "soft-badge-rose",
                                  action.riskLevel === "medium" && "soft-badge-amber",
                                  action.riskLevel === "low" && "soft-badge-teal",
                                )}
                              >
                                {action.riskLevel}
                              </Badge>
                              <Badge className="soft-badge-blue border-0">
                                {Math.round(action.confidence * 100)}%
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                            {JSON.stringify(action.editedArgs ?? action.originalArgs, null, 2)}
                          </pre>

                          {action.tool === "split_task" && action.status === "proposed" ? (
                            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                                <ListChecks className="h-3.5 w-3.5" />
                                选择要创建的子任务
                              </p>
                              <div className="grid gap-2">
                                {((action.editedArgs ?? action.originalArgs).subtasks as Array<{ title: string; dateKey: string }>)?.map((subtask, index) => (
                                  <label
                                    key={index}
                                    className={cn(
                                      "flex items-center gap-2.5 rounded-lg border border-blue-100 bg-white p-2.5 text-sm transition-colors hover:border-blue-300",
                                      (selectedSubtasks[action.id] ?? []).includes(index) && "border-blue-400 bg-blue-50",
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-blue-600"
                                      checked={(selectedSubtasks[action.id] ?? []).includes(index)}
                                      onChange={() => toggleSubtask(action.id, index)}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-slate-700">{subtask.title}</span>
                                    <span className="shrink-0 text-xs text-slate-400">{subtask.dateKey}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {action.status === "proposed" ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => approve(action)}>
                                <Check className="h-3.5 w-3.5" />
                                接受
                              </Button>
                              {["create_task", "update_task", "move_task"].includes(action.tool) ? (
                                <Button size="sm" variant="outline" onClick={() => openEdit(action)}>
                                  <Edit3 className="h-3.5 w-3.5" />
                                  编辑并接受
                                </Button>
                              ) : null}
                              <Button size="sm" variant="ghost" onClick={() => reject(action)}>
                                <X className="h-3.5 w-3.5" />
                                拒绝
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-4">
                              <Badge className="soft-badge-teal border-0">{action.status}</Badge>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-slate-600">
                {tab === "proposed" ? "没有待确认建议" : "暂无历史建议"}
              </p>
              <p className="text-xs text-slate-400">
                {tab === "proposed" ? "在仪表盘或目标页发起 Agent 请求" : "处理过的建议会显示在这里"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editAction)} onOpenChange={(open) => !open && setEditAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑建议参数</DialogTitle>
            <DialogDescription>保存后会立即按编辑后的参数接受并执行</DialogDescription>
          </DialogHeader>
          <Textarea value={editArgs} onChange={(event) => setEditArgs(event.target.value)} className="min-h-64 font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditAction(null)}>取消</Button>
            <Button onClick={saveEditAndApprove}>保存并接受</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
