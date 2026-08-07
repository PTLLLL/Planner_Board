"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { apiFetch, deleteJson, patchJson, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GoalItem {
  id: string;
  title: string;
  description: string;
  targetDate: string | null;
  status: string;
  source: string;
}

const emptyForm = { title: "", description: "", targetDate: "" };

export default function GoalsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoalItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [decomposingId, setDecomposingId] = useState<string | null>(null);

  const goals = useQuery({
    queryKey: ["goals", status],
    queryFn: () => apiFetch<GoalItem[]>(`/api/goals?status=${status}`),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["goals"] });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(goal: GoalItem) {
    setEditing(goal);
    setForm({ title: goal.title, description: goal.description, targetDate: goal.targetDate ?? "" });
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || undefined,
      targetDate: form.targetDate || undefined,
    };
    try {
      if (editing) {
        await patchJson(`/api/goals/${editing.id}`, payload);
        toast.success("目标已更新");
      } else {
        await postJson("/api/goals", payload);
        toast.success("目标已创建");
      }
      setOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function act(goal: GoalItem, action: "complete" | "archive" | "delete") {
    try {
      if (action === "complete") await postJson(`/api/goals/${goal.id}/complete`);
      if (action === "archive") await postJson(`/api/goals/${goal.id}/archive`);
      if (action === "delete") {
        if (!window.confirm(`确认删除目标「${goal.title}」？`)) return;
        await deleteJson(`/api/goals/${goal.id}`);
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }

  async function decompose(goal: GoalItem) {
    if (decomposingId) return;
    setDecomposingId(goal.id);
    try {
      await postJson("/api/agent/chat", {
        requestText: "帮我拆解这个目标",
        trigger: "goal_decompose",
        relatedGoalId: goal.id,
      });
      toast.success("拆解建议已生成");
      router.push("/agent/inbox");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "拆解失败");
    } finally {
      setDecomposingId(null);
    }
  }

  const statusLabel: Record<string, string> = {
    active: "进行中",
    completed: "已完成",
    archived: "已归档",
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">目标</p>
          <h1 className="page-title">目标管理</h1>
          <p className="page-subtitle">管理长期目标，并让 Agent 帮你拆解为每日任务</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建目标
        </Button>
      </header>

      <div className="panel-card fade-up">
        <div className="panel-card-body flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="icon-chip icon-chip-blue">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">目标会成为 Agent 规划上下文</p>
              <p className="mt-0.5 text-xs text-slate-500">
                拆解后的任务会按目标自动关联，进度在仪表盘中实时更新
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge className="soft-badge-blue border-0">
              <CalendarDays className="h-3 w-3" />
              支持目标日期
            </Badge>
            <Badge className="soft-badge-teal border-0">
              <Sparkles className="h-3 w-3" />
              AI 拆解
            </Badge>
          </div>
        </div>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="active">进行中</TabsTrigger>
          <TabsTrigger value="completed">已完成</TabsTrigger>
          <TabsTrigger value="archived">已归档</TabsTrigger>
        </TabsList>
        <TabsContent value={status}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.isLoading ? (
              <Skeleton className="h-44" />
            ) : goals.data?.length ? (
              goals.data.map((goal) => (
                <Card key={goal.id} className="fade-up overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-slate-50/90 to-blue-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="icon-chip icon-chip-blue">
                          <Flag className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="leading-6">{goal.title}</CardTitle>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {goal.targetDate ? `目标日期 ${goal.targetDate}` : "无目标日期"}
                          </p>
                        </div>
                      </div>
                      <Badge className="soft-badge-blue border-0">{goal.source}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 min-h-12 text-sm leading-6 text-slate-500">
                      {goal.description || "暂无描述"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {status === "active" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => decompose(goal)}
                            disabled={decomposingId !== null}
                          >
                            {decomposingId === goal.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            {decomposingId === goal.id ? "拆解中" : "拆解"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => act(goal, "complete")}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                            完成
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => act(goal, "archive")}>
                            <Archive className="h-3.5 w-3.5" />
                            归档
                          </Button>
                        </>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(goal)}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => act(goal, "delete")}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <span className="empty-state-icon">
                    <Flag className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium text-slate-600">
                    {statusLabel[status] ?? status}状态下暂无目标
                  </p>
                  <Button size="sm" className="mt-1" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    新建目标
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑目标" : "新建目标"}</DialogTitle>
            <DialogDescription>目标会进入 Agent 规划上下文</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="form-field">
              <Label htmlFor="goal-title">标题</Label>
              <Input id="goal-title" value={form.title} maxLength={120} required onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：完成 AI PM 作品集" />
            </div>
            <div className="form-field">
              <Label htmlFor="goal-description">描述</Label>
              <Textarea id="goal-description" value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="说明目标背景与完成标准" />
            </div>
            <div className="form-field">
              <Label htmlFor="goal-date">目标日期</Label>
              <Input id="goal-date" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">{editing ? "保存修改" : "创建目标"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
