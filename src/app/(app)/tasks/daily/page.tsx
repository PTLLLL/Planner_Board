"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { apiFetch, deleteJson, patchJson, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  description: string;
  dateKey: string;
  startTime: string | null;
  endTime: string | null;
  estimateMinutes: number | null;
  priority: string;
  isDone: boolean;
  source: string;
  goalId: string | null;
}

interface GoalItem {
  id: string;
  title: string;
}

const emptyForm = {
  title: "",
  description: "",
  startTime: "",
  endTime: "",
  estimateMinutes: "",
  priority: "medium",
  goalId: "",
};

const priorityLabel: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export default function DailyTasksPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState(date);
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(() => new Set());

  function setTaskBusy(id: string, busy: boolean) {
    setBusyTaskIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const tasks = useQuery({
    queryKey: ["tasks", date],
    queryFn: () => apiFetch<TaskItem[]>(`/api/tasks?fromDate=${date}&toDate=${date}`),
  });
  const goals = useQuery({
    queryKey: ["goals-active"],
    queryFn: () => apiFetch<GoalItem[]>("/api/goals?status=active"),
  });

  useEffect(() => {
    setMoveDate(date);
    setForm(emptyForm);
    setEditingId(null);
  }, [date]);

  const doneCount = useMemo(() => tasks.data?.filter((task) => task.isDone).length ?? 0, [tasks.data]);
  const totalCount = tasks.data?.length ?? 0;
  const estimateTotal = useMemo(
    () => tasks.data?.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0) ?? 0,
    [tasks.data],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["tasks", date] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || undefined,
      dateKey: date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      estimateMinutes: form.estimateMinutes ? Number(form.estimateMinutes) : undefined,
      priority: form.priority,
      goalId: form.goalId || undefined,
    };
    try {
      if (editingId) {
        await patchJson(`/api/tasks/${editingId}`, payload);
        toast.success("任务已更新");
      } else {
        await postJson("/api/tasks", payload);
        toast.success("任务已创建");
      }
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function toggle(task: TaskItem) {
    if (busyTaskIds.has(task.id)) return;
    const targetDone = !task.isDone;
    setTaskBusy(task.id, true);
    queryClient.setQueryData<TaskItem[]>(["tasks", date], (old) =>
      old?.map((item) =>
        item.id === task.id ? { ...item, isDone: targetDone } : item,
      ),
    );
    try {
      await postJson(`/api/tasks/${task.id}/${targetDone ? "complete" : "uncomplete"}`);
      await refresh();
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["tasks", date] });
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setTaskBusy(task.id, false);
    }
  }

  async function moveTask(task: TaskItem) {
    try {
      await postJson(`/api/tasks/${task.id}/move`, { newDateKey: moveDate });
      toast.success("任务已移动");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "移动失败");
    }
  }

  async function removeTask(task: TaskItem) {
    if (!window.confirm(`确认删除任务「${task.title}」？`)) return;
    try {
      await deleteJson(`/api/tasks/${task.id}`);
      toast.success("任务已删除");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  const completionRate = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">任务</p>
          <h1 className="page-title">每日任务</h1>
          <p className="page-subtitle">维护当天待办，完成后同步更新目标与日历</p>
        </div>
        <Input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) {
              router.replace(`/tasks/daily?date=${event.target.value}`, { scroll: false });
            }
          }}
          className="w-auto"
        />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">任务总数</span>
            <span className="icon-chip icon-chip-blue">
              <CalendarPlus className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{totalCount}</span>
          <p className="mt-1 text-xs text-slate-400">{date}</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">已完成</span>
            <span className="icon-chip icon-chip-teal">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{doneCount}</span>
          <p className="mt-1 text-xs text-slate-400">保持节奏，完成一项少一项</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">预计总时长</span>
            <span className="icon-chip icon-chip-amber">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{estimateTotal} <span className="text-base font-semibold text-slate-400">分钟</span></span>
          <div className="mt-3 flex items-center gap-2">
            <div className="progress-track flex-1">
              <div className="progress-fill" style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-500">{completionRate}%</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="fade-up self-start">
          <CardHeader>
            <CardTitle>{editingId ? "编辑任务" : "新建任务"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="form-field">
                <Label htmlFor="title">标题</Label>
                <Input id="title" value={form.title} maxLength={160} required onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：整理简历项目经历" />
              </div>
              <div className="form-field">
                <Label htmlFor="description">描述</Label>
                <Textarea id="description" value={form.description} maxLength={1000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="补充任务背景或完成标准" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-field">
                  <Label htmlFor="startTime">开始</Label>
                  <Input id="startTime" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="form-field">
                  <Label htmlFor="endTime">结束</Label>
                  <Input id="endTime" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-field">
                  <Label htmlFor="estimate">预计时长（分钟）</Label>
                  <Input id="estimate" type="number" min={5} max={480} value={form.estimateMinutes} onChange={(e) => setForm({ ...form, estimateMinutes: e.target.value })} />
                </div>
                <div className="form-field">
                  <Label htmlFor="priority">优先级</Label>
                  <Select id="priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </Select>
                </div>
              </div>
              <div className="form-field">
                <Label htmlFor="goal">关联目标</Label>
                <Select id="goal" value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
                  <option value="">无</option>
                  {goals.data?.map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.title}</option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1">
                  {editingId ? (
                    <>
                      <Pencil className="h-4 w-4" />
                      保存修改
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      添加任务
                    </>
                  )}
                </Button>
                {editingId ? (
                  <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                    取消
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="fade-up">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>
              任务列表
              <span className="ml-2 text-sm font-normal text-slate-400">{doneCount}/{totalCount}</span>
            </CardTitle>
            <Badge className="soft-badge-blue border-0">
              <CheckCircle2 className="h-3 w-3" />
              {completionRate}% 完成
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.isLoading ? (
              <Skeleton className="h-40" />
            ) : tasks.data?.length ? (
              tasks.data.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "task-row flex flex-col gap-3 p-4",
                    task.isDone && "task-row-done",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1 h-full min-h-9 w-1 shrink-0 rounded-full",
                        task.priority === "high"
                          ? "bg-rose-400"
                          : task.priority === "low"
                            ? "bg-slate-300"
                            : "bg-amber-400",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn("text-sm font-semibold leading-6 text-slate-900", task.isDone && "line-through text-slate-400")}>
                          {task.title}
                        </p>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={task.isDone ? "取消完成" : "完成"}
                            disabled={busyTaskIds.has(task.id)}
                            onClick={() => toggle(task)}
                          >
                            {busyTaskIds.has(task.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : task.isDone ? (
                              <Undo2 className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="编辑" onClick={() => {
                            setEditingId(task.id);
                            setForm({
                              title: task.title,
                              description: task.description,
                              startTime: task.startTime ?? "",
                              endTime: task.endTime ?? "",
                              estimateMinutes: task.estimateMinutes ? String(task.estimateMinutes) : "",
                              priority: task.priority,
                              goalId: task.goalId ?? "",
                            });
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="删除" onClick={() => removeTask(task)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-sm leading-5 text-slate-500">{task.description}</p>
                      ) : null}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Badge
                          className={cn(
                            "border-0",
                            task.priority === "high" && "soft-badge-rose",
                            task.priority === "medium" && "soft-badge-amber",
                            task.priority === "low" && "soft-badge-blue",
                          )}
                        >
                          {priorityLabel[task.priority] ?? task.priority}
                        </Badge>
                        <Badge className="soft-badge-blue border-0">{task.source || "manual"}</Badge>
                        {task.startTime ? (
                          <Badge className="soft-badge-teal border-0">
                            <Clock className="h-3 w-3" />
                            {task.startTime}{task.endTime ? `-${task.endTime}` : ""}
                          </Badge>
                        ) : null}
                        {task.estimateMinutes ? (
                          <Badge className="soft-badge-teal border-0">{task.estimateMinutes} 分钟</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs font-medium text-slate-400">移动到</span>
                    <Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className="h-8 w-40" />
                    <Button variant="outline" size="sm" onClick={() => moveTask(task)}>
                      移动到此日期
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <CalendarPlus className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-slate-600">当天还没有任务</p>
                <p className="text-xs text-slate-400">用左侧表单添加第一项任务</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
