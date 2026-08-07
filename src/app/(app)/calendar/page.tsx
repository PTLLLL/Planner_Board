"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  dateKey: string;
  isDone: boolean;
  priority: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date());

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );
  const fromDate = format(gridStart, "yyyy-MM-dd");
  const toDate = format(gridEnd, "yyyy-MM-dd");

  const tasks = useQuery({
    queryKey: ["calendar", month.getFullYear(), month.getMonth(), fromDate, toDate],
    queryFn: () =>
      apiFetch<TaskItem[]>(`/api/tasks?fromDate=${fromDate}&toDate=${toDate}`),
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks.data ?? []) {
      const list = map.get(task.dateKey) ?? [];
      list.push(task);
      map.set(task.dateKey, list);
    }
    return map;
  }, [tasks.data]);

  const monthTaskCount = useMemo(
    () =>
      (tasks.data ?? []).filter((task) =>
        task.dateKey.startsWith(format(month, "yyyy-MM")),
      ).length,
    [tasks.data, month],
  );
  const taskDays = useMemo(
    () =>
      Array.from(grouped.values()).filter(
        (list) => list[0]?.dateKey.startsWith(format(month, "yyyy-MM")),
      ).length,
    [grouped, month],
  );

  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">日程</p>
          <h1 className="page-title">日历</h1>
          <p className="page-subtitle">按月查看任务分布，点击日期进入每日待办</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1 shadow-sm">
            <Button variant="ghost" size="icon" aria-label="上个月" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="min-w-32 text-center text-sm font-semibold text-slate-800">
              {format(month, "yyyy 年 M 月")}
            </p>
            <Button variant="ghost" size="icon" aria-label="下个月" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => setMonth(new Date())}
          >
            <CalendarDays className="h-4 w-4" />
            回到今天
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">本月任务</span>
            <span className="icon-chip icon-chip-blue">
              <ListTodo className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{tasks.isLoading || tasks.isPlaceholderData ? "…" : monthTaskCount}</span>
          <p className="mt-1 text-xs text-slate-400">当前月份任务总数</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">有任务的天数</span>
            <span className="icon-chip icon-chip-teal">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{tasks.isLoading || tasks.isPlaceholderData ? "…" : taskDays}</span>
          <p className="mt-1 text-xs text-slate-400">已排布任务的日期数</p>
        </div>
        <div className="metric-card fade-up">
          <div className="metric-card-topline">
            <span className="metric-label">今天</span>
            <span className="icon-chip icon-chip-amber">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
          <span className="metric-value">{todayKey.slice(5)}</span>
          <p className="mt-1 text-xs text-slate-400">{format(new Date(), "EEEE")}</p>
        </div>
      </div>

      <div className="panel-card fade-up">
        <div className="panel-card-header">
          <div>
            <h2 className="panel-card-title">月历</h2>
            <p className="mt-0.5 text-xs text-slate-400">点击任意日期查看当天任务</p>
          </div>
          <Badge className="soft-badge-blue border-0">
            <CalendarDays className="h-3 w-3" />
            {tasks.isFetching ? "同步中" : format(month, "yyyy-MM")}
          </Badge>
        </div>
        <div className="panel-card-body">
          {tasks.isLoading ? (
            <Skeleton className="h-[520px]" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 border-b border-border pb-3 text-center text-xs font-semibold text-slate-400">
                {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className={cn("grid grid-cols-7 gap-1.5 pt-3 transition-opacity duration-150", tasks.isPlaceholderData && "opacity-60")}>
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayTasks = grouped.get(key) ?? [];
                  const isToday = key === todayKey;
                  const inMonth = isSameMonth(day, month);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => router.push(`/tasks/daily?date=${key}`, { scroll: false })}
                      className={cn(
                        "group min-h-24 rounded-lg border border-border bg-white p-2 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
                        !inMonth && "bg-slate-50/60 text-slate-300",
                        isToday && "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/20",
                        dayTasks.length > 0 && "border-blue-200",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold",
                          isToday
                            ? "bg-blue-600 text-white"
                            : dayTasks.length > 0
                              ? "bg-blue-100 text-blue-700"
                              : "text-slate-500",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-2 space-y-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              "truncate rounded-md px-1.5 py-1 text-[11px] leading-3.5",
                              task.isDone
                                ? "bg-slate-100 text-slate-400 line-through"
                                : task.priority === "high"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-blue-50 text-blue-700",
                            )}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 ? (
                          <p className="px-1 text-[11px] font-medium text-slate-400">
                            +{dayTasks.length - 3} 项
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
