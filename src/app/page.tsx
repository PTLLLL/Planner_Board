import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Flag,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const previewTasks = [
  { day: "5", color: "bg-blue-500" },
  { day: "6", color: "bg-teal-500" },
  { day: "9", color: "bg-amber-400" },
  { day: "12", color: "bg-blue-500" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-teal-50/60">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-sm">
              <Target className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-tight text-slate-900">Planner Agent</span>
              <span className="block text-xs font-medium text-slate-500">目标驱动的 AI 日程规划</span>
            </span>
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild>
              <Link href="/register">注册</Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <section className="fade-up">
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl">
              目标驱动的 AI 日程规划
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Planner Agent 读取你的目标、任务、日期和完成率，生成结构化日程建议。
              所有写操作都需要你确认，运行记录和动作日志完整保留。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">
                  开始使用
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">已有账号</Link>
              </Button>
            </div>
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                { icon: Flag, label: "目标拆解", note: "长目标变步骤" },
                { icon: CalendarDays, label: "每日规划", note: "按日期自动排布" },
                { icon: ShieldCheck, label: "可控执行", note: "先建议后确认" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border bg-white/80 p-3 shadow-sm">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                      <span className="block truncate text-xs text-slate-500">{item.note}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-white p-5 shadow-float fade-up">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">August 2026</p>
                <p className="mt-0.5 text-sm text-slate-500">AI 已为你安排本周节奏</p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <CalendarDays className="h-5 w-5" />
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
              {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                <span key={day} className="py-1">{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }, (_, index) => {
                const day = index + 1;
                const task = previewTasks.find((item) => item.day === String(day));
                return (
                  <div
                    key={day}
                    className={cn(
                      "min-h-12 rounded-md border p-1 text-[11px]",
                      task ? "border-blue-200 bg-blue-50/60" : "border-slate-100",
                      day === 5 && "border-blue-400 bg-blue-100/80",
                    )}
                  >
                    <span className={day === 5 ? "font-bold text-blue-700" : "text-slate-600"}>{day}</span>
                    {task ? (
                      <div className="mt-1.5 space-y-1">
                        <div className={cn("h-1.5 rounded-full", task.color)} />
                        {day === 5 ? <div className="h-1.5 rounded-full bg-teal-500/80" /> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Agent 建议</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    把“整理简历项目经历”拆为 3 个步骤，安排在明日上午完成。
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                完成率趋势
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                建议可确认
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}
