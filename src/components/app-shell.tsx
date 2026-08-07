"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Flag,
  Gauge,
  Inbox,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
  TerminalSquare,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { apiFetch, postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { href: "/dashboard", label: "仪表盘", icon: Gauge },
  { href: "/calendar", label: "日历", icon: CalendarDays },
  { href: "/tasks/daily", label: "每日任务", icon: CheckSquare },
  { href: "/goals", label: "目标", icon: Flag },
  { href: "/agent/inbox", label: "Agent 收件箱", icon: Inbox },
  { href: "/settings", label: "设置", icon: Settings },
];

const secondaryNav = [
  { href: "/agent/console", label: "Agent 控制台", icon: TerminalSquare },
  { href: "/eval", label: "评估", icon: ClipboardList },
];

const mobileNav = [...nav, ...secondaryNav];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const pending = useQuery({
    queryKey: ["nav-pending"],
    queryFn: () =>
      apiFetch<{ total: number }>("/api/agent/actions?status=proposed&pageSize=1"),
  });
  const goals = useQuery({
    queryKey: ["nav-goals"],
    queryFn: () => apiFetch<Array<{ id: string }>>("/api/goals?status=active"),
  });

  useEffect(() => {
    postJson("/api/events", {
      eventName: "page_viewed",
      sessionId: getSessionId(),
      pageRoute: pathname,
      properties: {
        route: pathname,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      },
    }).catch(() => undefined);
  }, [pathname]);

  async function logout() {
    await postJson("/api/auth/logout");
    toast.success("已退出登录");
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col overflow-y-auto border-r border-border bg-card px-3 py-4 lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-sm">
            <Target className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight text-slate-900">Planner Agent</span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500">目标驱动的 AI 规划</span>
          </span>
        </Link>

        <p className="section-label px-3 pb-2">主工作台</p>
        <nav className="space-y-1" aria-label="主导航">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-item", active && "nav-item-active")}
              >
                <span className="nav-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.href === "/agent/inbox" && pending.data?.total ? (
                  <span className="nav-badge">{pending.data.total}</span>
                ) : null}
                {item.href === "/goals" && goals.data?.length ? (
                  <span className="nav-badge">{goals.data.length}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <p className="section-label mt-6 px-3 pb-2">Agent 与质量</p>
        <nav className="space-y-1" aria-label="辅助导航">
          {secondaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("nav-item", active && "nav-item-active")}
              >
                <span className="nav-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          <div className="flex items-center gap-3 rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-teal-600 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-teal-800">写操作需确认</span>
              <span className="block text-[11px] text-teal-700/80">所有 Agent 改动可审计</span>
            </span>
          </div>
          <Button variant="ghost" className="w-full justify-start px-3" onClick={logout}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-sm">
              <Target className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-bold text-slate-900">Planner Agent</span>
          </Link>
          <div className="flex items-center gap-1">
            {pending.data?.total ? (
              <Link
                href="/agent/inbox"
                aria-label="待确认建议"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Inbox className="h-[18px] w-[18px]" />
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white">
                  {pending.data.total}
                </span>
              </Link>
            ) : null}
            <Link
              href="/settings"
              aria-label="设置"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <button
              type="button"
              aria-label="退出登录"
              onClick={logout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <nav
          aria-label="移动端导航"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden"
        >
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="mx-auto max-w-[1400px] p-4 pb-24 lg:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}

function getSessionId(): string {
  let id = window.sessionStorage.getItem("planner_session_id");
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem("planner_session_id", id);
  }
  return id;
}
