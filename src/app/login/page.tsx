"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, LogIn, ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") || "/dashboard");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/auth/login", {
        email: form.get("email"),
        password: form.get("password"),
      });
      toast.success("登录成功");
      router.push(next);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-sky-600 via-blue-600 to-teal-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/25">
            <Target className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight">Planner Agent</span>
            <span className="block text-sm text-white/80">目标驱动的 AI 日程规划</span>
          </span>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-3xl font-bold leading-tight">把长期目标变成今天可执行的计划</h1>
          <p className="mt-4 text-base leading-7 text-white/85">
            Agent 读取目标、任务与完成率后生成结构化建议，所有写操作先确认、后执行，并保留完整审计记录。
          </p>
          <div className="mt-8 space-y-3">
            {["自然语言创建、移动、拆分任务", "按目标自动拆解为每日步骤", "风险分级、可编辑、可审计"].map((text) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck className="h-4 w-4" />
          V1.0 写操作确认机制不可关闭
        </p>
      </section>

      <section className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-7">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-sm lg:hidden">
              <Target className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">登录</h1>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">继续管理你的目标、任务与 Agent 建议</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="form-field">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
            </div>
            <div className="form-field">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="输入密码" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            还没有账号？<Link className="font-medium text-blue-600 hover:text-blue-700" href="/register">注册</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
